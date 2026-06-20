import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { sanitizeInput, escapeRegex } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { searchFaqs, addFaqToQdrant, deleteFaqFromQdrant, generateQdrantId } from '@/lib/qdrant';

export const dynamic = 'force-dynamic';

// Helper to check admin authentication (supports both role-based and legacy token)
async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminRole = cookieStore.get('admin_role');
  if (adminRole && (adminRole.value === 'super_admin' || adminRole.value === 'admin')) {
    return true;
  }
  // Legacy fallback
  const adminToken = cookieStore.get('admin_token');
  return !!(adminToken && adminToken.value === 'authenticated');
}

// GET /api/faqs — list all FAQs or search
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'faqs-get', RATE_LIMITS.search);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');

    let faqs;
    if (q && q.trim()) {
      // Use AI Semantic Search via Qdrant
      const sanitized = sanitizeInput(q);
      faqs = await searchFaqs(sanitized, 5);
    } else {
      // Return all FAQs if no query
      faqs = await db
        .collection('faqs')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }

    return Response.json({ faqs });
  } catch (error) {
    console.error('GET /api/faqs error:', error);
    return Response.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}

// POST /api/faqs — admin only: add a new FAQ
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'faqs-post', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Check admin auth
    if (!(await isAdminAuthenticated())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const question = sanitizeInput(body.question || '');
    const answer = sanitizeInput(body.answer || '');
    const category = sanitizeInput(body.category || '');

    if (!question || !answer) {
      return Response.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const db = await getDb();
    const qdrantId = generateQdrantId();
    const result = await db.collection('faqs').insertOne({
      question,
      answer,
      category,
      qdrantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await addFaqToQdrant(qdrantId, question, answer, category);
    } catch (error) {
      console.error('Failed to add FAQ to Qdrant:', error);
      // Proceed anyway, but in production we might want a retry queue or rollback
    }

    return Response.json({
      success: true,
      id: result.insertedId.toString()
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/faqs error:', error);
    return Response.json({ error: 'Failed to add FAQ' }, { status: 500 });
  }
}

// DELETE /api/faqs — admin only: delete a FAQ
export async function DELETE(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'faqs-delete', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    // Check admin auth
    if (!(await isAdminAuthenticated())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || !/^[a-f0-9]{24}$/.test(id)) {
      return Response.json({ error: 'Valid FAQ ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const faq = await db.collection('faqs').findOne({ _id: new ObjectId(id) });
    if (!faq) {
      return Response.json({ error: 'FAQ not found' }, { status: 404 });
    }

    const result = await db.collection('faqs').deleteOne({ _id: new ObjectId(id) });

    if (faq.qdrantId) {
      try {
        await deleteFaqFromQdrant(faq.qdrantId);
      } catch (error) {
        console.error('Failed to delete FAQ from Qdrant:', error);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/faqs error:', error);
    return Response.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}