import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/queries/upvote — toggle upvote on a query (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-upvote', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Require user auth
    const user = await verifySession();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { queryId } = body;

    if (!queryId) {
      return Response.json({ error: 'Query ID is required' }, { status: 400 });
    }

    // Validate ObjectId format to prevent injection
    if (!/^[a-f0-9]{24}$/.test(queryId)) {
      return Response.json({ error: 'Invalid query ID format' }, { status: 400 });
    }

    const db = await getDb();
    const query = await db.collection('queries').findOne({ _id: new ObjectId(queryId) });

    if (!query) {
      return Response.json({ error: 'Query not found' }, { status: 404 });
    }

    const userId = user.userId;
    const upvotedBy: string[] = query.upvotedBy || [];
    const hasUpvoted = upvotedBy.includes(userId);

    if (hasUpvoted) {
      // Remove upvote
      await db.collection('queries').updateOne(
        { _id: new ObjectId(queryId) },
        {
          $pull: { upvotedBy: userId } as any,
          $inc: { upvotes: -1 },
          $set: { updatedAt: new Date() },
        }
      );

      const newCount = Math.max((query.upvotes || 0) - 1, 0);
      return Response.json({
        success: true,
        upvotes: newCount,
        hasUpvoted: false,
        message: 'Upvote removed',
      });
    } else {
      // Add upvote
      await db.collection('queries').updateOne(
        { _id: new ObjectId(queryId) },
        {
          $push: { upvotedBy: userId } as any,
          $inc: { upvotes: 1 },
          $set: { updatedAt: new Date() },
        }
      );

      const newCount = (query.upvotes || 0) + 1;
      return Response.json({
        success: true,
        upvotes: newCount,
        hasUpvoted: true,
        message: 'Upvote added',
      });
    }
  } catch (error) {
    console.error('POST /api/queries/upvote error:', error);
    return Response.json({ error: 'Failed to process upvote' }, { status: 500 });
  }
}
