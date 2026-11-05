import { rateLimit } from "express-rate-limit";

export function createRateLimiter(limit) {
  return rateLimit({
    windowMs: 1 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    },
  });
}
