import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { generateTicketId } from '@/lib/ticketId';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// GET /api/queries — get query by ticketId, by userId, or get active queries
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-get', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const ticketId = searchParams.get('ticketId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    if (ticketId) {
      const sanitizedTicketId = sanitizeInput(ticketId);
      const query = await db.collection('queries').findOne({ ticketId: sanitizedTicketId });
      if (!query) {
        return Response.json({ error: 'Query not found' }, { status: 404 });
      }
      return Response.json({ query });
    }

    // Fetch queries by userId (user's own queries)
    if (userId) {
      try {
        const queries = await db
          .collection('queries')
          .find({ userId: new ObjectId(userId) })
          .sort({ createdAt: -1 })
          .toArray();
        return Response.json({ queries });
      } catch {
        return Response.json({ queries: [] });
      }
    }

    if (status === 'active') {
      // Get one random active query for solving
      const activeQueries = await db
        .collection('queries')
        .find({ status: { $in: ['active', 'in-review'] } })
        .toArray();

      if (activeQueries.length === 0) {
        return Response.json({ query: null });
      }

      const randomIndex = Math.floor(Math.random() * activeQueries.length);
      return Response.json({ query: activeQueries[randomIndex] });
    }

    // Return all queries
    const queries = await db
      .collection('queries')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({ queries });
  } catch (error) {
    console.error('GET /api/queries error:', error);
    return Response.json({ error: 'Failed to fetch queries' }, { status: 500 });
  }
}

// POST /api/queries — create a new query (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-post', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Require user auth
    const user = await verifySession();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const question = sanitizeInput(body.question || '');

    if (!question) {
      return Response.json({ error: 'Question is required' }, { status: 400 });
    }

    const db = await getDb();
    const ticketId = generateTicketId();

    await db.collection('queries').insertOne({
      ticketId,
      question,
      status: 'active',
      proposedAnswer: null,
      approvals: [],
      requiredApprovals: 3,
      upvotes: 0,
      upvotedBy: [],
      userId: new ObjectId(user.userId),
      username: user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({ success: true, ticketId }, { status: 201 });
  } catch (error) {
    console.error('POST /api/queries error:', error);
    return Response.json({ error: 'Failed to create query' }, { status: 500 });
  }
}
