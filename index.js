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
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   SESSION STORE & QUEUE
======================= */
const sessions = new Map();
const queue = [];
let processingQueue = false;

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) { // 5 min expiry
      sessions.delete(id);
      const index = queue.indexOf(id);
      if (index !== -1) queue.splice(index, 1);
    }
  }
}, 60_000);

/* =======================
   API ROUTES
======================= */

// Create a new verification session
app.post("/create", (req, res) => {
  const id = nanoid(12);

  sessions.set(id, {
    id,
    createdAt: Date.now(),
    verified: false,
    queued: true
  });

  queue.push(id);

  res.json({
    success: true,
    id,
    url: `https://beanierot.cc/v/${id}`,
    position: queue.length
  });
});

// Verify the front-of-queue user
app.post("/verify/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ success: false });

  // Only allow the first in queue to verify
  if (queue[0] !== session.id) {
    return res.status(400).json({
      success: false,
      message: `You are in queue. Position: ${queue.indexOf(session.id) + 1}`
    });
  }

  // Mark as verified
  session.verified = true;
  session.queued = false;

  // Remove from queue
  queue.shift();

  // Optional: 2-second delay before next verification
  setTimeout(() => {}, 2000);

  return res.json({ success: true });
});

// Get session status for frontend polling
app.get("/status/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ success: false });

  res.json({
    success: true,
    verified: session.verified,
    queued: session.queued,
    queuePosition: session.queued ? queue.indexOf(session.id) + 1 : 0
  });
});

/* =======================
   FRONTEND ROUTE
======================= */
app.get("/v/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "v.html"));
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log(`Verification server running on port ${PORT}`);
});
