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

/* =======================
   SESSION STORE & QUEUE
======================= */
const sessions = new Map();

// Queue system: array of session IDs waiting for verification
const queue = [];
let processingQueue = false;

// Auto cleanup expired sessions (5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) {
      sessions.delete(id);
      const index = queue.indexOf(id);
      if (index !== -1) queue.splice(index, 1);
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
    verified: false,
    queued: true
  });

  queue.push(id); // add to verification queue

  res.json({
    success: true,
    id,
    url: `https://beanierot.cc/v/${id}`,
    position: queue.length
  });
});

/* VERIFY (frontend calls this) */
app.post("/verify/:id", async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ success: false });

  // Check queue position
  const position = queue.indexOf(session.id);
  if (position === -1) {
    return res.status(400).json({ success: false, message: "Already verified or not in queue" });
  }

  if (position > 0) {
    return res.json({
      success: false,
      message: `You are in queue. Position: ${position + 1}`
    });
  }

  // Process verification
  session.verified = true;
  session.queued = false;

  // Remove from queue
  queue.shift();

  // Start processing next in queue after 2 seconds
  if (!processingQueue) processQueue();

  res.json({ success: true });
});

/* STATUS (Discord bot checks this) */
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
   QUEUE PROCESSING
======================= */
async function processQueue() {
  processingQueue = true;
  while (queue.length > 0) {
    const nextId = queue[0];
    const session = sessions.get(nextId);
    if (!session) {
      queue.shift();
      continue;
    }

    // Wait 2 seconds before allowing next user
    await new Promise(r => setTimeout(r, 2000));
    queue.shift();
  }
  processingQueue = false;
}

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
