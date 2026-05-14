/**
 * In-memory rate limiter: 20 AI calls per hour per user.
 * For production, replace with Redis-backed storage.
 */

const store = new Map();

const AI_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getRateLimitKey(req) {
  if (req.user && req.user.id) return `user:${req.user.id}`;
  return `ip:${req.ip}`;
}

function aiRateLimiter(req, res, next) {
  const key = getRateLimitKey(req);
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  if (entry.count >= AI_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many AI requests. Limit is 20 calls per hour.',
      retryAfter,
      resetAt: new Date(entry.resetAt).toISOString(),
    });
  }

  entry.count += 1;
  res.set('X-RateLimit-Limit', AI_LIMIT);
  res.set('X-RateLimit-Remaining', AI_LIMIT - entry.count);
  res.set('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());

  next();
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

module.exports = { aiRateLimiter };
