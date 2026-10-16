import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Human, type HumanDoc } from "../models/Human";

export type AuthedRequest = Request & {
  human: HumanDoc;
  humanId: string;
};

interface JwtPayload {
  sub: string;
}

export function signToken(humanId: string): string {
  return jwt.sign({ sub: humanId }, config.jwtSecret, { expiresIn: config.jwtTtl });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing authorization token" });
      return;
    }
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const human = await Human.findById(payload.sub);
    if (!human) {
      res.status(401).json({ error: "Human not found" });
      return;
    }
    (req as AuthedRequest).human = human;
    (req as AuthedRequest).humanId = human._id.toString();
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Optional auth for SSE when token is passed as query param */
export async function requireAuthFlexible(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  return requireAuth(req, res, next);
}
