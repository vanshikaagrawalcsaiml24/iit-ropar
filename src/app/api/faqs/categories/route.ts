import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { FAQ_CATEGORIES, resolveLegacyCategory } from '@/lib/categories';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// GET /api/faqs/categories — return category hierarchy with FAQ counts
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'faqs-categories', RATE_LIMITS.search);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const db = await getDb();

    // Get all FAQs to compute counts
    const allFaqs = await db.collection('faqs').find({}).toArray();

    // Build counts per category and subcategory
    const categoryCounts: Record<string, number> = {};
    const subcategoryCounts: Record<string, Record<string, number>> = {};

    for (const cat of FAQ_CATEGORIES) {
      categoryCounts[cat.name] = 0;
      subcategoryCounts[cat.name] = {};
      for (const sub of cat.subcategories) {
        subcategoryCounts[cat.name][sub] = 0;
      }
    }

    for (const faq of allFaqs) {
      // If FAQ already has the new category + subcategory fields, use them
      if (faq.subcategory && faq.category) {
        const catName = faq.category;
        const subName = faq.subcategory;
        if (categoryCounts[catName] !== undefined) {
          categoryCounts[catName]++;
          if (subcategoryCounts[catName]?.[subName] !== undefined) {
            subcategoryCounts[catName][subName]++;
          }
        }
      } else {
        // Resolve legacy category
        const resolved = resolveLegacyCategory(faq.category || '');
        categoryCounts[resolved.category] = (categoryCounts[resolved.category] || 0) + 1;
        if (subcategoryCounts[resolved.category]) {
          subcategoryCounts[resolved.category][resolved.subcategory] =
            (subcategoryCounts[resolved.category][resolved.subcategory] || 0) + 1;
        }
      }
    }

    const categories = FAQ_CATEGORIES.map((cat) => ({
      name: cat.name,
      icon: cat.icon,
      gradient: cat.gradient,
      description: cat.description,
      faqCount: categoryCounts[cat.name] || 0,
      subcategories: cat.subcategories.map((sub) => ({
        name: sub,
        faqCount: subcategoryCounts[cat.name]?.[sub] || 0,
      })),
    }));

    return Response.json({ categories });
  } catch (error) {
    console.error('GET /api/faqs/categories error:', error);
    return Response.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
