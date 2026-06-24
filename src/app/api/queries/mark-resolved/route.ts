import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-resolve', RATE_LIMITS.api);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs!);

    const user = await verifySession();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const ticketId = sanitizeInput(body.ticketId || '');

    if (!ticketId) return Response.json({ error: 'Ticket ID is required' }, { status: 400 });

    const db = await getDb();
    const query = await db.collection('queries').findOne({ ticketId });
    if (!query) return Response.json({ error: 'Query not found' }, { status: 404 });

    // Only the asker can resolve it
    if (query.userId.toString() !== user.userId) {
      return Response.json({ error: 'Only the asker can mark this query as resolved' }, { status: 403 });
    }

    if (query.status === 'resolved' || query.status === 'escalated') {
      return Response.json({ error: 'Query is already resolved or escalated' }, { status: 400 });
    }

    await db.collection('queries').updateOne(
      { ticketId },
      {
        $set: {
          status: 'resolved',
          proposedAnswer: query.proposedAnswer || 'Resolved by the asker.',
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true, message: 'Query marked as resolved' });
  } catch (error) {
    console.error('POST /api/queries/mark-resolved error:', error);
    return Response.json({ error: 'Failed to resolve query' }, { status: 500 });
  }
}
