import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getCategories, resolveToKnownCategory } from '@/lib/categories';
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

    // Get dynamic categories
    const dynamicCategories = await getCategories();

    // Get all FAQs to compute counts
    const allFaqs = await db.collection('faqs').find({}).toArray();

    // Build counts per category and subcategory
    const categoryCounts: Record<string, number> = {};
    const subcategoryCounts: Record<string, Record<string, number>> = {};

    for (const cat of dynamicCategories) {
      categoryCounts[cat.name] = 0;
      subcategoryCounts[cat.name] = {};
      for (const sub of cat.subcategories) {
        subcategoryCounts[cat.name][sub] = 0;
      }
    }

    for (const faq of allFaqs) {
      // Resolve category properly (if unknown, goes to Other > General)
      const resolved = resolveToKnownCategory(faq.category || '', faq.subcategory || '', dynamicCategories);
      
      const catName = resolved.category;
      const subName = resolved.subcategory;

      if (categoryCounts[catName] !== undefined) {
        categoryCounts[catName]++;
        if (subcategoryCounts[catName]?.[subName] !== undefined) {
          subcategoryCounts[catName][subName]++;
        } else {
           // Fallback to general/first subcategory count if somehow the subcategory count map wasn't initialized for it
           const firstSub = dynamicCategories.find(c => c.name === catName)?.subcategories[0] || 'General';
           if (subcategoryCounts[catName]?.[firstSub] !== undefined) {
               subcategoryCounts[catName][firstSub]++;
           }
        }
      }
    }

    const categories = dynamicCategories.map((cat) => ({
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
