import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-change-me";

if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

app.use("/api/admin", adminRouter);
app.use("/api", publicRouter);

if (process.env.NODE_ENV === "production") {
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

app.listen(PORT, () => {
  console.log(`DinnerSeats server listening on http://localhost:${PORT}`);
});
