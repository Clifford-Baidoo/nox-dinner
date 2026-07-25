import type { Request, Response, NextFunction } from "express";

export const SESSION_COOKIE = "dinnerseats_admin";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const value = req.signedCookies?.[SESSION_COOKIE];
  if (value !== "ok") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
