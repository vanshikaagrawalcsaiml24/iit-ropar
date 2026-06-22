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
      const user = await verifySession();
      if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Auto-escalate queries unresolved (active/in-review) for 48 hours
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await db.collection('queries').updateMany(
        {
          status: { $in: ['active', 'in-review'] },
          createdAt: { $lt: fortyEightHoursAgo }
        },
        {
          $set: {
            status: 'escalated',
            escalatedAt: new Date(),
            autoEscalated: true,
            updatedAt: new Date()
          }
        }
      );

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      // Support exclude param for skipped queries
      const excludeIds = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
      const excludeObjectIds = excludeIds.map(id => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      }).filter((id): id is ObjectId => id !== null);

      const queryFilter: any = {
        userId: { $ne: new ObjectId(user.userId) },
        status: { $in: ['active', 'in-review', 'escalated'] },
        createdAt: { $gte: tenDaysAgo },
        approvals: { $ne: user.userId }
      };

      if (excludeObjectIds.length > 0) {
        queryFilter._id = { $nin: excludeObjectIds };
      }

      // Priority of which was asked first: sort by createdAt ascending (1)
      const queries = await db.collection('queries')
        .find(queryFilter)
        .sort({ createdAt: 1 })
        .limit(10)
        .toArray();

      return Response.json({ queries });
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
    const title = sanitizeInput(body.title || '');

    if (!question) {
      return Response.json({ error: 'Question is required' }, { status: 400 });
    }

    const db = await getDb();
    const ticketId = generateTicketId();

    await db.collection('queries').insertOne({
      ticketId,
      title: title || question.substring(0, 60),
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
