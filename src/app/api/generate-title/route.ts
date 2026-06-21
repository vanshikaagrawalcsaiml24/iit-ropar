import { type NextRequest } from 'next/server';
import { sanitizeInput } from '@/lib/security';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Simple NLP-based title generation from a query body.
 * Uses extractive summarization heuristics:
 * 1. Takes the first sentence if it's short enough
 * 2. Extracts key noun phrases
 * 3. Falls back to truncation with ellipsis
 */
function generateTitle(query: string): string {
  const cleaned = query.trim().replace(/\s+/g, ' ');

  // If query is already short, use it as-is
  if (cleaned.length <= 60) {
    return cleaned;
  }

  // Try to extract the first sentence
  const sentenceEnders = /[.!?]\s/;
  const firstSentenceMatch = cleaned.match(sentenceEnders);
  if (firstSentenceMatch && firstSentenceMatch.index) {
    const firstSentence = cleaned.substring(0, firstSentenceMatch.index + 1);
    if (firstSentence.length <= 80 && firstSentence.length >= 15) {
      return firstSentence;
    }
  }

  // Extract question pattern if present (e.g., "How do I...", "What is...", "Where can I...")
  const questionPatterns = [
    /(?:how\s+(?:do|can|to|should|would|could)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:what\s+(?:is|are|was|were|should|would|could)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:where\s+(?:is|are|can|do|should)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:when\s+(?:is|are|can|do|should|will)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:why\s+(?:is|are|do|does|should|would|can't)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:can\s+(?:I|we|someone|students)\s+.{10,60}?)(?=[.?!]|$)/i,
    /(?:is\s+(?:there|it|this)\s+.{10,60}?)(?=[.?!]|$)/i,
  ];

  for (const pattern of questionPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let title = match[0].trim();
      if (!title.endsWith('?')) title += '?';
      return title;
    }
  }

  // Remove common filler words and extract key phrases
  const stopWords = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
    'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
    'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above',
    'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'can', 'will', 'just', 'don', 'should', 'now', 'also', 'want', 'need',
    'please', 'help', 'would', 'could', 'really', 'actually', 'basically',
  ]);

  // Extract important words
  const words = cleaned.split(/\s+/);
  const importantWords = words.filter(w => !stopWords.has(w.toLowerCase().replace(/[^a-z]/g, '')));

  if (importantWords.length >= 3) {
    // Build a title from first several important words
    let title = importantWords.slice(0, 8).join(' ');
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    return title;
  }

  // Fallback: truncate at word boundary
  if (cleaned.length > 60) {
    const truncated = cleaned.substring(0, 57);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  return cleaned;
}

// POST /api/generate-title — generate a concise title from query text
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, 'generate-title', RATE_LIMITS.api);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!);
    }

    const user = await verifySession();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const query = sanitizeInput(body.query || '');

    if (!query) {
      return Response.json({ error: 'Query text is required' }, { status: 400 });
    }

    const title = generateTitle(query);

    return Response.json({ title });
  } catch (error) {
    console.error('POST /api/generate-title error:', error);
    return Response.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
