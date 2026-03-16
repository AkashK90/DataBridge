import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createStorage } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const apiUrl = process.env.API_URL || "";

app.use(express.json({ limit: "1mb" }));

// Serve built React app in production (after npm run build)
app.use(express.static(path.join(__dirname, "dist")));

const clients = new Set();
const storage = await createStorage();
await storage.init();

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    res.write(data);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, apiUrl });
});

// Trigger a fetch to the configured API and store the result
app.post("/api/trigger", async (req, res) => {
  const targetUrl = req.body?.url || apiUrl;
  if (!targetUrl) {
    return res.status(400).json({ ok: false, error: "Missing API_URL or url in body" });
  }

  try {
    const startedAt = new Date().toISOString();
    const response = await fetch(targetUrl);
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    let data = raw;
    if (contentType.includes("application/json")) {
      try { data = JSON.parse(raw); } catch { data = raw; }
    }

    const event = { timestamp: startedAt, status: response.status, contentType, data };
    const stored = await storage.add(event);
    broadcast(stored);
    res.json({ ok: true, event: stored });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Return all collected events
app.get("/api/events", (req, res) => {
  storage
    .list()
    .then((events) => res.json({ ok: true, count: events.length, events }))
    .catch((err) => res.status(500).json({ ok: false, error: err.message }));
});

// Server-Sent Events stream
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  storage
    .list()
    .then((events) => {
      for (const event of events) res.write(`data: ${JSON.stringify(event)}\n\n`);
    })
    .catch(() => {});

  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// SPA fallback — must come after all /api routes
app.get("*", (req, res) => {
  const distIndex = path.join(__dirname, "dist", "index.html");
  res.sendFile(distIndex, (err) => {
    if (err) res.status(404).send("Run `npm run build` first, or use `npm run dev` for development.");
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`  Dev mode  : run 'npm run dev' (Vite on :5173 + API on :${port})`);
  console.log(`  Prod mode : run 'npm run build' then 'npm start'`);
});
