import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sanitizeInput } from '@/lib/security';
import { addFaqToQdrant, generateQdrantId } from '@/lib/qdrant';

export const dynamic = 'force-dynamic';

// Helper to check admin authentication
async function isAdminAuthenticated(): Promise<{ authenticated: boolean; role?: string }> {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    const adminRole = cookieStore.get('admin_role');
    if (adminToken?.value === 'authenticated') {
        return { authenticated: true, role: adminRole?.value || 'admin' };
    }
    return { authenticated: false };
}

// GET /api/admin/escalated — fetch all escalated queries
export async function GET() {
    try {
        const auth = await isAdminAuthenticated();
        if (!auth.authenticated) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDb();
        const escalatedQueries = await db.collection('queries')
            .find({ status: 'escalated' })
            .sort({ createdAt: -1 })
            .toArray();

        return Response.json({ queries: escalatedQueries });
    } catch (error) {
        console.error('GET /api/admin/escalated error:', error);
        return Response.json({ error: 'Failed to fetch escalated queries' }, { status: 500 });
    }
}

// POST /api/admin/escalated — admin answers an escalated query (auto-creates FAQ)
export async function POST(request: NextRequest) {
    try {
        const auth = await isAdminAuthenticated();
        if (!auth.authenticated) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { queryId, answer } = body;

        if (!queryId || !/^[a-f0-9]{24}$/.test(queryId)) {
            return Response.json({ error: 'Valid query ID is required' }, { status: 400 });
        }

        const sanitizedAnswer = sanitizeInput(answer || '');
        if (!sanitizedAnswer.trim()) {
            return Response.json({ error: 'Answer is required' }, { status: 400 });
        }

        const db = await getDb();
        const query = await db.collection('queries').findOne({ _id: new ObjectId(queryId) });

        if (!query) {
            return Response.json({ error: 'Query not found' }, { status: 404 });
        }

        if (query.status !== 'escalated') {
            return Response.json({ error: 'Query is not in escalated status' }, { status: 400 });
        }

        // Mark query as resolved
        await db.collection('queries').updateOne(
            { _id: new ObjectId(queryId) },
            {
                $set: {
                    status: 'resolved',
                    proposedAnswer: sanitizedAnswer.trim(),
                    resolvedByAdmin: true,
                    resolvedAt: new Date(),
                    updatedAt: new Date(),
                },
            }
        );

        // Auto-create FAQ from the resolved query
        const question = sanitizeInput(query.question || '');
        const qdrantId = generateQdrantId();

        await db.collection('faqs').insertOne({
            question,
            answer: sanitizedAnswer.trim(),
            category: 'Admin Resolved',
            qdrantId,
            createdFromQuery: queryId,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Embed and add to Qdrant vector database
        try {
            await addFaqToQdrant(qdrantId, question, sanitizedAnswer.trim(), 'Admin Resolved');
        } catch (error) {
            console.error('Failed to add FAQ to Qdrant:', error);
        }

        return Response.json({
            success: true,
            message: 'Query resolved and FAQ created',
        });
    } catch (error) {
        console.error('POST /api/admin/escalated error:', error);
        return Response.json({ error: 'Failed to resolve query' }, { status: 500 });
    }
}
