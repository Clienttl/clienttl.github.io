import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

/* __dirname fix for ES modules */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* middleware */
app.use(cors());
app.use(express.json());

/* =======================
   IN-MEMORY SESSIONS
======================= */
const sessions = new Map();

/* cleanup expired sessions (5 min) */
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60_000);

/* =======================
   API ROUTES
======================= */

/* CREATE verification */
app.post("/create", (req, res) => {
  const id = nanoid(12);

  sessions.set(id, {
    id,
    createdAt: Date.now(),
    verified: false
  });

  res.json({
    success: true,
    id,
    url: `https://beanierot.cc/v/${id}`
  });
});

/* VERIFY (frontend calls this) */
app.post("/verify/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false });
  }

  session.verified = true;
  res.json({ success: true });
});

/* STATUS (Discord bot checks this) */
app.get("/status/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false });
  }

  res.json({
    success: true,
    verified: session.verified
  });
});

/* =======================
   FRONTEND ROUTE
======================= */

/* Serve verification page for ANY /v/:id */
app.get("/v/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "v.html"));
});

/* =======================
   START SERVER
======================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
