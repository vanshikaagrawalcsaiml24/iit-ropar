import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sanitizeInput } from '@/lib/security';
import { updateFaqInQdrant, getAllFaqsFromQdrant } from '@/lib/qdrant';

export const dynamic = 'force-dynamic';

// Helper to check super admin authentication
async function isSuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');
  const adminRole = cookieStore.get('admin_role');
  return !!(
    adminToken?.value === 'authenticated' &&
    adminRole?.value === 'super_admin'
  );
}

// GET /api/admin/vector-faqs — fetch all FAQs from Qdrant
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return Response.json({ error: 'Unauthorized — super admin access required' }, { status: 403 });
    }

    // Fetch directly from Qdrant
    const qdrantFaqs = await getAllFaqsFromQdrant();

    // Fetch mappings from MongoDB
    const db = await getDb();
    const mongoFaqs = await db.collection('faqs').find({ qdrantId: { $exists: true, $ne: null } }).toArray();
    const mongoMap = new Map(mongoFaqs.map(f => [f.qdrantId, f._id.toString()]));

    return Response.json({
      faqs: qdrantFaqs.map((qFaq) => {
        const mongoId = mongoMap.get(qFaq.qdrantId);
        return {
          _id: mongoId || qFaq.qdrantId, // Use MongoDB ID if exists, otherwise fallback to Qdrant UUID
          qdrantId: qFaq.qdrantId,
          question: qFaq.question || '',
          answer: qFaq.answer || '',
          category: qFaq.category || 'Other',
          subcategory: qFaq.subcategory || '',
          isEmbedded: true,
          isOrphaned: !mongoId, // Flag to indicate it's not in MongoDB
          createdAt: qFaq.createdAt,
          updatedAt: qFaq.updatedAt,
        };
      }).sort((a, b) => {
        // Sort orphaned items to the top, then by updated date
        if (a.isOrphaned && !b.isOrphaned) return -1;
        if (!a.isOrphaned && b.isOrphaned) return 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }),
    });
  } catch (error) {
    console.error('GET /api/admin/vector-faqs error:', error);
    return Response.json({ error: 'Failed to fetch vector FAQs from Qdrant' }, { status: 500 });
  }
}

// PUT /api/admin/vector-faqs — update a FAQ and re-embed it in Qdrant
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return Response.json({ error: 'Unauthorized — super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, question, answer, category, subcategory } = body;

    if (!id) {
      return Response.json({ error: 'Valid FAQ ID is required' }, { status: 400 });
    }

    const sanitizedQuestion = sanitizeInput(question || '');
    const sanitizedAnswer = sanitizeInput(answer || '');
    if (!sanitizedQuestion.trim() || !sanitizedAnswer.trim()) {
      return Response.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const sanitizedCategory = sanitizeInput(category || 'Other');
    const sanitizedSubcategory = sanitizeInput(subcategory || '');

    const db = await getDb();

    let existingFaq = null;
    let oldQdrantId = id;

    if (/^[a-f0-9]{24}$/.test(id)) {
      existingFaq = await db.collection('faqs').findOne({ _id: new ObjectId(id) });
      if (existingFaq && existingFaq.qdrantId) {
        oldQdrantId = existingFaq.qdrantId;
      }
    } else {
      existingFaq = await db.collection('faqs').findOne({ qdrantId: id });
    }

    // Update the vector in Qdrant (delete old, create new with fresh embedding)
    let newQdrantId: string;
    try {
      newQdrantId = await updateFaqInQdrant(
        oldQdrantId,
        sanitizedQuestion.trim(),
        sanitizedAnswer.trim(),
        sanitizedCategory.trim(),
        sanitizedSubcategory.trim()
      );
    } catch (error) {
      console.error('Failed to update FAQ in Qdrant:', error);
      return Response.json({ error: 'Failed to update vector embeddings in Qdrant' }, { status: 500 });
    }

    if (existingFaq) {
      // Update the FAQ document in MongoDB
      await db.collection('faqs').updateOne(
        { _id: existingFaq._id },
        {
          $set: {
            question: sanitizedQuestion.trim(),
            answer: sanitizedAnswer.trim(),
            category: sanitizedCategory.trim(),
            subcategory: sanitizedSubcategory.trim(),
            qdrantId: newQdrantId,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Orphaned FAQ that was only in Qdrant, insert into MongoDB to sync
      await db.collection('faqs').insertOne({
        question: sanitizedQuestion.trim(),
        answer: sanitizedAnswer.trim(),
        category: sanitizedCategory.trim(),
        subcategory: sanitizedSubcategory.trim(),
        qdrantId: newQdrantId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return Response.json({
      success: true,
      message: 'FAQ updated and re-embedded successfully',
      newQdrantId,
    });
  } catch (error) {
    console.error('PUT /api/admin/vector-faqs error:', error);
    return Response.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}
