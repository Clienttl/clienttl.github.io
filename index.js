import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve frontend
app.use("/v", express.static(path.join(__dirname, "public")));

const sessions = new Map();

/* cleanup */
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60_000);

/* CREATE */
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

/* VERIFY */
app.post("/verify/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ success: false });

  s.verified = true;
  res.json({ success: true });
});

/* STATUS */
app.get("/status/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ success: false });

  res.json({
    success: true,
    verified: s.verified
  });
});

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
