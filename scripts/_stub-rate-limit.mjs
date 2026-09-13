// scripts/_stub-rate-limit.mjs — always-allow rate limiter for handler tests.
export async function checkRateLimit() { return { allowed: true, remaining: 99 }; }
export default checkRateLimit;
