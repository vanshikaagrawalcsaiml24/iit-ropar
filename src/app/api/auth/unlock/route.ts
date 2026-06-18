import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS, resetFailedAttempts } from '@/lib/rateLimit';
import { generateOTP, sendUnlockEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/unlock — send unlock OTP to email
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/unlock', RATE_LIMITS.unlock);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const email = sanitizeInput(body.email || '').toLowerCase();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return Response.json({ success: true, message: 'If an account exists, an unlock code has been sent.' });
    }

    // Generate unlock OTP
    const otp = generateOTP();
    await db.collection('email_verifications').deleteMany({ email, type: 'unlock' });
    await db.collection('email_verifications').insertOne({
      email,
      code: otp,
      type: 'unlock',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
    });

    await sendUnlockEmail(email, user.username, otp);

    return Response.json({ success: true, message: 'Unlock code sent to your email.' });
  } catch (error) {
    console.error('POST /api/auth/unlock error:', error);
    return Response.json({ error: 'Failed to send unlock code' }, { status: 500 });
  }
}

// PUT /api/auth/unlock — verify unlock OTP and unlock account
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/unlock-verify', RATE_LIMITS.otp);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const email = sanitizeInput(body.email || '').toLowerCase();
    const code = sanitizeInput(body.code || '');

    if (!email || !code) {
      return Response.json({ error: 'Email and unlock code are required' }, { status: 400 });
    }

    const db = await getDb();

    // Find valid unlock OTP
    const verification = await db.collection('email_verifications').findOne({
      email,
      code,
      type: 'unlock',
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return Response.json({ error: 'Invalid or expired unlock code' }, { status: 400 });
    }

    // Unlock account
    await db.collection('users').updateOne(
      { email },
      { $set: { lockedUntil: null, failedAttempts: 0 } }
    );

    // Reset in-memory counter
    const user = await db.collection('users').findOne({ email });
    if (user) {
      resetFailedAttempts(user.username);
    }

    // Cleanup OTP
    await db.collection('email_verifications').deleteMany({ email, type: 'unlock' });

    return Response.json({
      success: true,
      message: 'Account unlocked! You can now log in.',
    });
  } catch (error) {
    console.error('PUT /api/auth/unlock error:', error);
    return Response.json({ error: 'Unlock failed' }, { status: 500 });
  }
}
