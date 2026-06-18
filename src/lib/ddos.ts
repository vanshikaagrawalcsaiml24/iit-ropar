/**
 * DDoS Protection — Progressive penalty system
 * Tracks request velocity per IP and applies progressive bans
 */

interface DDoSEntry {
  count: number;
  windowStart: number;
  banUntil: number;
  tier: number; // 0 = no ban, 1 = throttled, 2 = temp ban, 3 = extended ban
}

const ddosStore = new Map<string, DDoSEntry>();

// Cleanup expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ddosStore.entries()) {
    if (now > entry.banUntil && now - entry.windowStart > 120000) {
      ddosStore.delete(key);
    }
  }
}, 2 * 60 * 1000);

// Tier thresholds (requests per 60 seconds)
const TIER_1_THRESHOLD = 100; // Throttle with 429
const TIER_2_THRESHOLD = 200; // 5-minute IP ban
const TIER_3_THRESHOLD = 500; // 30-minute IP ban

// Ban durations in milliseconds
const TIER_2_BAN_MS = 5 * 60 * 1000;  // 5 minutes
const TIER_3_BAN_MS = 30 * 60 * 1000; // 30 minutes

const WINDOW_MS = 60 * 1000; // 1-minute sliding window

/**
 * Check if an IP is allowed or should be blocked due to DDoS detection
 */
export function checkDDoS(ip: string): {
  allowed: boolean;
  tier: number;
  bannedUntil?: number;
  retryAfterMs?: number;
} {
  const now = Date.now();
  let entry = ddosStore.get(ip);

  // Check if IP is currently banned
  if (entry && entry.banUntil > now) {
    return {
      allowed: false,
      tier: entry.tier,
      bannedUntil: entry.banUntil,
      retryAfterMs: entry.banUntil - now,
    };
  }

  // Initialize or reset window
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 1, windowStart: now, banUntil: 0, tier: 0 };
    ddosStore.set(ip, entry);
    return { allowed: true, tier: 0 };
  }

  entry.count++;

  // Check thresholds
  if (entry.count >= TIER_3_THRESHOLD) {
    entry.tier = 3;
    entry.banUntil = now + TIER_3_BAN_MS;
    console.warn(`[DDoS] Tier 3 ban for IP: ${ip} (${entry.count} req/min) — 30 min ban`);
    return {
      allowed: false,
      tier: 3,
      bannedUntil: entry.banUntil,
      retryAfterMs: TIER_3_BAN_MS,
    };
  }

  if (entry.count >= TIER_2_THRESHOLD) {
    entry.tier = 2;
    entry.banUntil = now + TIER_2_BAN_MS;
    console.warn(`[DDoS] Tier 2 ban for IP: ${ip} (${entry.count} req/min) — 5 min ban`);
    return {
      allowed: false,
      tier: 2,
      bannedUntil: entry.banUntil,
      retryAfterMs: TIER_2_BAN_MS,
    };
  }

  if (entry.count >= TIER_1_THRESHOLD) {
    entry.tier = 1;
    return {
      allowed: false,
      tier: 1,
      retryAfterMs: WINDOW_MS - (now - entry.windowStart),
    };
  }

  return { allowed: true, tier: 0 };
}

/**
 * Create a DDoS block response
 */
export function ddosBlockResponse(tier: number, retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  const messages: Record<number, string> = {
    1: 'Rate limit exceeded. Please slow down.',
    2: 'Your IP has been temporarily blocked due to excessive requests. Please try again later.',
    3: 'Your IP has been blocked due to suspicious activity. Contact support if this is an error.',
  };

  return Response.json(
    {
      error: messages[tier] || 'Too many requests.',
      retryAfterSeconds: retryAfterSec,
      blocked: tier >= 2,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Tier': String(tier),
      },
    }
  );
}

/**
 * Check request payload size (DDoS protection for large payloads)
 */
export function checkPayloadSize(contentLength: string | null, maxBytes: number = 10240): boolean {
  if (!contentLength) return true;
  const size = parseInt(contentLength);
  return !isNaN(size) && size <= maxBytes;
}
