import { QdrantClient } from '@qdrant/js-client-rest';
import Embedder from './embeddings';
import { randomUUID } from 'crypto';

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION_NAME || 'faq_vectors';

if (!url || !apiKey) {
  console.error("Qdrant credentials are missing in environment variables!");
}

const client = new QdrantClient({ url, apiKey });

// Helper to perform semantic search
export async function searchFaqs(question: string, topK: number = 5) {
  if (!question.trim()) return [];

  // Generate embedding for the question
  const vector = await Embedder.embed(question);

  // Search in Qdrant
  const searchResults = await client.search(collectionName, {
    vector,
    limit: topK,
    with_payload: true,
  });

  // Filter out low scores (threshold 0.40 just like Python backend)
  const MIN_RELEVANCE_SCORE = 0.40;
  const relevant = searchResults.filter((r) => r.score >= MIN_RELEVANCE_SCORE);

  // Map to FAQ format
  return relevant.map((r, idx) => {
    const payload: any = r.payload || {};
    return {
      _id: `qdrant-${r.id}-${idx}`,
      question: payload.question,
      answer: payload.answer,
      category: payload.category,
      score: r.score,
      tags: payload.tags,
    };
  });
}

/**
 * Add a FAQ to Qdrant vector database.
 * Generates embedding from question+answer text and upserts to collection.
 */
export async function addFaqToQdrant(
  qdrantId: string,
  question: string,
  answer: string,
  category?: string,
  subcategory?: string
) {
  const textToEmbed = `${question} ${answer}`;
  const vector = await Embedder.embed(textToEmbed);

  await client.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: qdrantId,
        vector,
        payload: {
          question,
          answer,
          category: category || '',
          subcategory: subcategory || '',
          tags: [],
          createdAt: new Date().toISOString(),
        },
      },
    ],
  });
}

/**
 * Delete a FAQ from Qdrant vector database by its qdrantId.
 */
export async function deleteFaqFromQdrant(qdrantId: string) {
  await client.delete(collectionName, {
    wait: true,
    points: [qdrantId],
  });
}

/**
 * Generate a UUID for use as Qdrant point IDs
 */
export function generateQdrantId(): string {
  return randomUUID();
}

export default client;
