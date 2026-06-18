import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifyPassword, sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS, trackFailedAttempt, resetFailedAttempts } from '@/lib/rateLimit';
import { checkDDoS, ddosBlockResponse } from '@/lib/ddos';
import { createSession, logLoginAttempt } from '@/lib/session';
import { sendAccountLockedEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/login — authenticate user with 3-attempt lockout
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // DDoS check
    const ddos = checkDDoS(ip);
    if (!ddos.allowed) {
      return ddosBlockResponse(ddos.tier, ddos.retryAfterMs!);
    }

    // Rate limit (IP-based)
    const rl = checkRateLimit(ip, 'auth/login', RATE_LIMITS.auth);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const identifier = sanitizeInput(body.identifier || '').toLowerCase();
    const password = body.password || '';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!identifier || !password) {
      return Response.json({ error: 'Username/email and password are required' }, { status: 400 });
    }

    const db = await getDb();

    // Find user by username or email
    const user = await db.collection('users').findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user) {
      await logLoginAttempt(null, identifier, ip, userAgent, false);
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      await logLoginAttempt(user._id.toString(), user.username, ip, userAgent, false);
      return Response.json({
        error: `Account is locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
        locked: true,
        lockedUntil: user.lockedUntil,
        canUnlockViaEmail: true,
      }, { status: 403 });
    }

    // Check if email is verified (skip for Google OAuth users)
    if (user.authProvider === 'local' && user.emailVerified === false) {
      return Response.json({
        error: 'Email not verified. Please check your inbox for the verification code.',
        requiresVerification: true,
        email: user.email,
      }, { status: 403 });
    }

    // Google OAuth users can't login with password
    if (user.authProvider === 'google' && !user.passwordHash) {
      return Response.json({
        error: 'This account uses Google sign-in. Please use the "Sign in with Google" button.',
        useGoogle: true,
      }, { status: 400 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logLoginAttempt(user._id.toString(), user.username, ip, userAgent, false);

      // Track failed attempt (3-attempt lockout)
      const lockResult = trackFailedAttempt(user.username);

      if (lockResult.shouldLock) {
        // Lock the account in DB
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lockedUntil: lockUntil, failedAttempts: lockResult.failedCount } }
        );

        // Send lock notification email
        sendAccountLockedEmail(user.email, user.username).catch(() => {});

        return Response.json({
          error: 'Account locked after 3 failed attempts. Check your email for instructions.',
          locked: true,
          lockedUntil: lockUntil,
          canUnlockViaEmail: true,
        }, { status: 403 });
      }

      return Response.json({
        error: 'Invalid credentials',
        remainingAttempts: lockResult.remainingAttempts,
      }, { status: 401 });
    }

    // Success — reset failed attempts
    resetFailedAttempts(user.username);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { failedAttempts: 0, lockedUntil: null } }
    );

    // Create session
    await createSession(user._id.toString(), user.username);

    // Log successful login
    await logLoginAttempt(user._id.toString(), user.username, ip, userAgent, true);

    return Response.json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        authProvider: user.authProvider || 'local',
      },
    });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
