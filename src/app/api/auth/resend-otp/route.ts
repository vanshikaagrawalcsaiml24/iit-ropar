import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { generateOTP, sendVerificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/resend-otp — resend verification OTP
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/resend-otp', RATE_LIMITS.resendOtp);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const body = await request.json();
    const email = sanitizeInput(body.email || '').toLowerCase();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();

    // Find unverified user
    const user = await db.collection('users').findOne({ email, emailVerified: false });
    if (!user) {
      // Don't reveal if user exists — just say sent
      return Response.json({ success: true, message: 'If an unverified account exists, a new code has been sent.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    await db.collection('email_verifications').deleteMany({ email, type: 'register' });
    await db.collection('email_verifications').insertOne({
      email,
      code: otp,
      type: 'register',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
    });

    await sendVerificationEmail(email, user.username, otp);

    return Response.json({ success: true, message: 'New verification code sent to your email.' });
  } catch (error) {
    console.error('POST /api/auth/resend-otp error:', error);
    return Response.json({ error: 'Failed to resend code' }, { status: 500 });
  }
}
