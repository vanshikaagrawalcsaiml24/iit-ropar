import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession, destroySession } from '@/lib/session';
import { generateToken, sendDeletionConfirmEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/delete-account — initiate account deletion (sends confirmation email)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/delete-account', RATE_LIMITS.otp);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Require session
    const sessionUser = await verifySession();
    if (!sessionUser) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(sessionUser.userId) });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate deletion token
    const token = generateToken();
    await db.collection('deletion_requests').deleteMany({ userId: user._id }); // remove old
    await db.collection('deletion_requests').insertOne({
      userId: user._id,
      token,
      email: user.email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      createdAt: new Date(),
    });

    // Send confirmation email (uses first 8 chars of token as code)
    await sendDeletionConfirmEmail(user.email, user.username, token);

    return Response.json({
      success: true,
      message: 'Deletion confirmation sent to your email. Enter the code to proceed.',
    });
  } catch (error) {
    console.error('POST /api/auth/delete-account error:', error);
    return Response.json({ error: 'Failed to initiate deletion' }, { status: 500 });
  }
}

// DELETE /api/auth/delete-account — confirm and execute permanent deletion
export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'auth/delete-confirm', RATE_LIMITS.otp);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const sessionUser = await verifySession();
    if (!sessionUser) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const code = sanitizeInput(body.code || '').toUpperCase();

    if (!code || code.length < 8) {
      return Response.json({ error: 'Confirmation code is required' }, { status: 400 });
    }

    const db = await getDb();
    const userId = new ObjectId(sessionUser.userId);

    // Find valid deletion request — match by first 8 chars of token
    const deletionRequests = await db.collection('deletion_requests').find({
      userId,
      expiresAt: { $gt: new Date() },
    }).toArray();

    const validRequest = deletionRequests.find(
      (req) => req.token.slice(0, 8).toUpperCase() === code
    );

    if (!validRequest) {
      return Response.json({ error: 'Invalid or expired confirmation code' }, { status: 400 });
    }

    // PERMANENT DELETION — remove all user data
    await Promise.all([
      db.collection('users').deleteOne({ _id: userId }),
      db.collection('sessions').deleteMany({ userId }),
      db.collection('queries').deleteMany({ userId }),
      db.collection('login_history').deleteMany({ userId }),
      db.collection('email_verifications').deleteMany({ email: validRequest.email }),
      db.collection('deletion_requests').deleteMany({ userId }),
    ]);

    // Destroy current session
    await destroySession();

    return Response.json({
      success: true,
      message: 'Account permanently deleted.',
    });
  } catch (error) {
    console.error('DELETE /api/auth/delete-account error:', error);
    return Response.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
