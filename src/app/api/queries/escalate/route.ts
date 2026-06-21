import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-escalate', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Require user auth
    const user = await verifySession();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const ticketId = sanitizeInput(body.ticketId || '');

    if (!ticketId) {
      return Response.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    const db = await getDb();
    
    // Find the query
    const query = await db.collection('queries').findOne({ ticketId });
    if (!query) {
      return Response.json({ error: 'Query not found' }, { status: 404 });
    }

    if (query.status !== 'resolved') {
      return Response.json({ error: 'Only resolved queries can be escalated' }, { status: 400 });
    }

    // Check if it has enough reviews (approvals). 
    const requiredApprovals = query.requiredApprovals || 3;
    const currentApprovals = query.approvals?.length || 0;
    
    if (currentApprovals < requiredApprovals) {
        return Response.json({ error: 'Query does not have enough peer reviews to be escalated' }, { status: 400 });
    }

    await db.collection('queries').updateOne(
      { ticketId },
      {
        $set: {
          status: 'escalated',
          escalatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true, message: 'Query escalated successfully' });
  } catch (error) {
    console.error('POST /api/queries/escalate error:', error);
    return Response.json({ error: 'Failed to escalate query' }, { status: 500 });
  }
}
