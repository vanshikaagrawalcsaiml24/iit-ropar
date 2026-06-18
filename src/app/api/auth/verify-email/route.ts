import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { createSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/auth/verify-email — verify OTP code
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/verify-email', RATE_LIMITS.otp);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const email = sanitizeInput(body.email || '').toLowerCase();
    const code = sanitizeInput(body.code || '');

    if (!email || !code) {
      return Response.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const db = await getDb();

    // Find valid OTP
    const verification = await db.collection('email_verifications').findOne({
      email,
      code,
      type: 'register',
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return Response.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // Mark user as verified
    const user = await db.collection('users').findOneAndUpdate(
      { email },
      { $set: { emailVerified: true } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Clean up used OTP
    await db.collection('email_verifications').deleteMany({ email, type: 'register' });

    // Auto-login: create session
    await createSession(user._id.toString(), user.username);

    return Response.json({
      success: true,
      message: 'Email verified successfully!',
      user: {
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('POST /api/auth/verify-email error:', error);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
