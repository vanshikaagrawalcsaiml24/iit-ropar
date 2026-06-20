import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/queries/solve — submit an answer or approve a solution (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'queries-solve', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Require user auth
    const user = await verifySession();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { queryId, action } = body;
    const answer = body.answer ? sanitizeInput(body.answer) : '';

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

    // Use userId from session for tracking
    const solverId = user.userId;

    // Action: submit answer
    if (action === 'answer') {
      if (!answer.trim()) {
        return Response.json({ error: 'Answer is required' }, { status: 400 });
      }

      if (query.status === 'resolved') {
        return Response.json({ error: 'Query is already resolved' }, { status: 400 });
      }

      // Set the proposed answer and change status to in-review
      // The answerer counts as the first approval
      await db.collection('queries').updateOne(
        { _id: new ObjectId(queryId) },
        {
          $set: {
            proposedAnswer: answer.trim(),
            status: 'in-review',
            approvals: [solverId],
            answeredBy: solverId,
            answeredByUsername: user.username,
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({ success: true, message: 'Answer submitted' });
    }

    // Action: approve
    if (action === 'approve') {
      if (query.status !== 'in-review') {
        return Response.json({ error: 'Query is not in review' }, { status: 400 });
      }

      // Check if already approved by this user
      if (query.approvals && query.approvals.includes(solverId)) {
        return Response.json({ error: 'You have already approved this solution' }, { status: 400 });
      }

      const newApprovals = [...(query.approvals || []), solverId];
      const isResolved = newApprovals.length >= (query.requiredApprovals || 3);

      await db.collection('queries').updateOne(
        { _id: new ObjectId(queryId) },
        {
          $set: {
            approvals: newApprovals,
            status: isResolved ? 'resolved' : 'in-review',
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({
        success: true,
        approvals: newApprovals.length,
        resolved: isResolved,
        message: isResolved ? 'Query resolved!' : 'Approval recorded',
      });
    }

    // Action: escalate
    if (action === 'escalate') {
      if (query.status === 'resolved' || query.status === 'escalated') {
        return Response.json({ error: 'Query cannot be escalated' }, { status: 400 });
      }

      await db.collection('queries').updateOne(
        { _id: new ObjectId(queryId) },
        {
          $set: {
            status: 'escalated',
            escalatedBy: solverId,
            escalatedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({
        success: true,
        message: 'Query has been escalated to admin',
      });
    }

    return Response.json({ error: 'Invalid action. Use "answer", "approve", or "escalate"' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/queries/solve error:', error);
    return Response.json({ error: 'Failed to process solution' }, { status: 500 });
  }
}
