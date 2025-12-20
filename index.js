import express from "express";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

// ES Modules replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
const tokenStore = new Map();
const TOKEN_TTL = 5 * 60 * 1000;

/* ================= CREATE VERIFICATION ================= */
app.post("/api/create", (req, res) => {
  const { userId, callback } = req.body;
  if (!userId || !callback) {
    return res.status(400).json({ error: "Missing userId or callback" });
  }

  const token = nanoid(32);
  tokenStore.set(token, {
    userId,
    callback,
    verified: false,
    createdAt: Date.now()
  });

  const url = `${req.protocol}://${req.get("host")}/v/${token}`;
  res.json({ url, token });
});

/* ================= VERIFY PAGE ================= */
app.get("/v/:token", (req, res) => {
  const token = tokenStore.get(req.params.token);
  if (!token) return res.status(404).send("Invalid or expired link");

  if (Date.now() - token.createdAt > TOKEN_TTL) {
    tokenStore.delete(req.params.token);
    return res.send("Verification link expired.");
  }

  res.sendFile(path.join(__dirname, "public", "verify.html"));
});

/* ================= HOLD CONFIRM ================= */
app.post("/api/confirm/:token", async (req, res) => {
  const entry = tokenStore.get(req.params.token);
  if (!entry) return res.status(404).json({ error: "Invalid token" });

  entry.verified = true;

  // 🔁 CALLBACK
  try {
    await fetch(entry.callback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: entry.userId,
        token: req.params.token,
        verified: true
      })
    });
  } catch (e) {
    console.error("Callback failed:", e.message);
  }

  tokenStore.delete(req.params.token);
  res.json({ success: true });
});

app.listen(PORT, () =>
  console.log("Verification API running on port", PORT)
);
