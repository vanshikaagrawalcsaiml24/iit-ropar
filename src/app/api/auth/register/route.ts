import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashPassword, validatePassword, sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { checkDDoS, ddosBlockResponse } from '@/lib/ddos';
import { generateOTP, sendVerificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/register — register a new user (sends OTP for verification)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // DDoS check
    const ddos = checkDDoS(ip);
    if (!ddos.allowed) {
      return ddosBlockResponse(ddos.tier, ddos.retryAfterMs!);
    }

    // Rate limit
    const rl = checkRateLimit(ip, 'auth/register', RATE_LIMITS.register);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const username = sanitizeInput(body.username || '').toLowerCase();
    const email = sanitizeInput(body.email || '').toLowerCase();
    const password = body.password || '';

    // Validate fields
    if (!username || username.length < 3 || username.length > 30) {
      return Response.json({ error: 'Username must be 3-30 characters' }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return Response.json({ error: 'Username can only contain lowercase letters, numbers, and underscores' }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return Response.json({ error: passwordCheck.errors[0], errors: passwordCheck.errors }, { status: 400 });
    }

    const db = await getDb();

    // Check for existing user
    const existing = await db.collection('users').findOne({
      $or: [{ username }, { email }],
    });

    if (existing) {
      if (existing.username === username) {
        return Response.json({ error: 'Username is already taken' }, { status: 409 });
      }
      return Response.json({ error: 'Email is already registered' }, { status: 409 });
    }

    // Hash password and create user (unverified)
    const passwordHash = await hashPassword(password);
    await db.collection('users').insertOne({
      username,
      email,
      passwordHash,
      emailVerified: false,
      authProvider: 'local',
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    // Generate OTP and store
    const otp = generateOTP();
    await db.collection('email_verifications').deleteMany({ email }); // remove old OTPs
    await db.collection('email_verifications').insertOne({
      email,
      code: otp,
      type: 'register',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date(),
    });

    // Send verification email
    await sendVerificationEmail(email, username, otp);

    return Response.json({
      success: true,
      requiresVerification: true,
      message: 'Account created! Check your email for the verification code.',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
