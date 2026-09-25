import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const limiter = (prefix: string, tokens: number, window: Duration) =>
  redis &&
  new Ratelimit({
    redis,
    prefix: `framey:ratelimit:${prefix}`,
    limiter: Ratelimit.slidingWindow(tokens, window),
  });

const limiters = {
  // Keyed by IP + email: stops password guessing without letting a stranger
  // lock someone out of their account by spamming their email.
  // ponytail: doesn't stop guessing spread across many IPs; add a looser
  // per-email limit if that shows up.
  login: limiter("login", 10, "15 m"),
  register: limiter("register", 5, "1 h"),
  completeProfile: limiter("complete-profile", 10, "1 m"),
};

/** Seconds until `key` may retry, or 0 when the request is allowed. */
export async function rateLimit(name: keyof typeof limiters, key: string) {
  const limit = limiters[name];
  if (!limit) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UPSTASH_REDIS_REST_URL/TOKEN must be set in production");
    }
    return 0; // No Upstash configured locally: don't block development.
  }
  const { success, reset } = await limit.limit(key);
  return success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

/** Set by Vercel and most proxies; the first entry is the client. */
export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function tooManyRequests(retryAfter: number) {
  return Response.json(
    { message: "Too many attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
