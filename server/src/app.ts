import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-change-me";

export const app = express();

if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

app.use("/api/admin", adminRouter);
app.use("/api", publicRouter);

// On Vercel, static files and the SPA fallback are handled by vercel.json's
// rewrites/filesystem routing, not by this Express app. This block only
// matters for traditional single-process hosting (VPS/Railway/Fly.io).
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
