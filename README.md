# Realtime API Dashboard

A **Vite + React** developer tool to hit any HTTP API and watch responses stream live onto a dashboard — with auto-hit scheduling, smart client-friendly views, charts, and one-click downloads.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ API Stream  ● LIVE  Auto-hit in 4:32  Events:12  Export │
├────────────────────────┬────────────────────────────────────┤
│  // Trigger API        │  200  3/14/2026, 12:18:58 AM       │
│  [ https://api... ]    │  ┌──────────────────────────────┐  │
│  ● Auto-hit active     │  │  Numeric Fields (Bar Chart)  │  │
│    next in 4:32        │  └──────────────────────────────┘  │
│  [ ──> Hit API ]       │  {                               │  │
│                        │    "country": "US",              │  │
│  // Event Log          │    "marketCap": 3754848...       │  │
│  ● 200  12:18:58       │  }       [⬇ Download] [Copy JSON]│  │
│  ● 200  12:17:11       │                                  │  │
│  ✗ 403  12:16:58       │                                  │  │
└────────────────────────┴────────────────────────────────────┘
```

---

## What's New in v2 (React rewrite)

- **Vite + React** — instant HMR, fast builds, no page lag
- **5-minute auto-hit** — hit once manually, then fires automatically every 5 min
- **Download JSON / CSV / PDF** — in both developer and client views
- **Recharts visualizations** — bar chart of numeric fields, pie chart of status distribution, timeline line chart
- **Smart data rendering** — JSON objects → labeled cards, arrays → tables, URLs → clickable links
- **Client View** at `/viewer` — clean, non-technical summary page for stakeholders
- **React Router** — `/` for dev, `/viewer` for clients, proper SPA navigation

---

## Project Structure

```
realtime-api-dashboard/
├── index.html             ← Vite root HTML entry point
├── vite.config.js         ← Vite + React + API proxy config
├── server.js              ← Express backend (API + SSE + serves dist/)
├── storage.js             ← SQLite / in-memory storage
├── package.json           ← All dependencies + scripts
├── .nvmrc                 ← Pins Node 18
├── .env.example           ← Environment variable template
├── .gitignore             ← Excludes node_modules/, dist/, data/, .env
└── src/
    ├── main.jsx           ← React entry point
    ├── App.jsx            ← React Router setup (/ and /viewer)
    ├── index.css          ← Global light theme styles
    ├── hooks/
    │   └── useEvents.js   ← SSE stream + event deduplication hook
    ├── utils/
    │   └── download.js    ← JSON / CSV / PDF export utilities
    └── pages/
        ├── DevDashboard.jsx   ← Developer view (/)
        └── ClientViewer.jsx   ← Client view (/viewer)
```

> `dist/` is created by `npm run build`. `data/events.db` is created automatically on first run.

---

## Requirements

| Tool    | Version |
|---------|---------|
| Node.js | **18+** |
| npm     | **9+**  |

```bash
node --version
npm --version
```

---

## Isolated Environment Setup (Recommended)

### Option A — nvm

**macOS / Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
```

**Windows:** Download from https://github.com/coreybutler/nvm-windows/releases

```bash
cd realtime-api-dashboard
nvm install 18
nvm use        # reads .nvmrc automatically
```

### Option B — Volta (auto-switching)

```bash
curl https://get.volta.sh | bash
cd realtime-api-dashboard
volta pin node@18
```

---

## Installation & Running

### Development Mode (recommended while building/testing)

Runs two servers concurrently:
- **Vite dev server** on port `5173` (React with HMR)
- **Express API server** on port `3000` (backend)

Vite proxies all `/api/*` calls to Express automatically.

```bash
# 1. Enter folder
cd realtime-api-dashboard

# 2. Activate Node (nvm users only)
nvm use

# 3. Install all dependencies
npm install

# 4. (Optional) configure environment
cp .env.example .env
# Edit .env as needed

# 5. Start both servers
npm run dev
```

Open **http://localhost:5173** — this is your React app in dev mode.

---

### Production Mode

Builds the React app into `dist/`, then Express serves everything on one port.

```bash
# 1. Build the React frontend
npm run build

# 2. Start Express (serves dist/ + API on port 3000)
npm start
```

Open **http://localhost:3000**

---

## How Auto-Hit Works

1. Type a URL in the input field
2. Click **Hit API** once (first manual trigger)
3. The dashboard records that URL and starts a **5-minute countdown**
4. Every 5 minutes it automatically POSTs to the same URL
5. The countdown resets after each auto-hit
6. If you change the URL and hit again manually → timer resets with the new URL
7. Click **Stop auto-hit** in the banner to cancel

---

## Download Formats

| Format | Contents | Best for |
|--------|----------|----------|
| JSON   | Raw event array with all fields | Developers, further processing |
| CSV    | Flat table (id, timestamp, status, contentType, data) | Excel, Google Sheets |
| PDF    | Formatted report with summary + table | Sharing with stakeholders, printing |

Download buttons appear in:
- **Dev view topbar** → Export All events
- **Dev view detail pane** → Download selected event only
- **Client view topbar** → Download All
- **Client view Latest / All Events tabs** → Download that view's data

---

## Configuration

| Variable     | Default          | Description                                      |
|--------------|------------------|--------------------------------------------------|
| `PORT`       | `3000`           | Express server port                              |
| `API_URL`    | _(empty)_        | Pre-fills the URL input in the dashboard         |
| `USE_SQLITE` | `1`              | Set to `0` for in-memory storage (no file)       |
| `DB_PATH`    | `data/events.db` | SQLite database path                             |

### Setting variables

**macOS / Linux:**
```bash
export API_URL="https://api.example.com/data"
npm run dev
```

**Windows PowerShell:**
```powershell
$env:API_URL = "https://api.example.com/data"
npm run dev
```

**Windows CMD:**
```cmd
set API_URL=https://api.example.com/data
npm run dev
```

---

## Pages

| URL | Who uses it | Description |
|-----|-------------|-------------|
| `http://localhost:5173/` (dev) or `http://localhost:3000/` (prod) | Developer | Full dashboard: trigger API, inspect raw JSON, auto-hit, charts |
| `…/viewer` | Client / Stakeholder | Clean view: summary cards, tables, charts, PDF export |

---

## API Reference

### `GET /api/health`
```json
{ "ok": true, "apiUrl": "https://example.com/api" }
```

### `POST /api/trigger`
```json
// Request body
{ "url": "https://jsonplaceholder.typicode.com/posts/1" }

// Response
{ "ok": true, "event": { "id": 1, "timestamp": "...", "status": 200, "contentType": "...", "data": {} } }
```

### `GET /api/events`
```json
{ "ok": true, "count": 5, "events": [ ... ] }
```

### `GET /api/stream`
SSE stream — replays history on connect, pushes new events live.

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite (port 5173) + Express (port 3000) concurrently |
| `npm run build` | Build React app into `dist/` |
| `npm start` | Serve built app from Express on port 3000 |
| `npm run preview` | Preview the production build locally via Vite |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run dev` shows "concurrently: not found" | Run `npm install` first |
| Blank page at localhost:5173 | Check `src/main.jsx` exists and Vite started without errors |
| `/api/...` returns 404 in dev | Make sure Express is running on port 3000 (both start with `npm run dev`) |
| `npm start` shows "dist not found" | Run `npm run build` first |
| `sqlite3` error on Windows | Run `npm install --build-from-source` or set `USE_SQLITE=0` |
| Port 3000 already in use | Set `PORT=4001` in `.env` |
| Auto-hit not starting | You must click Hit API manually once first |
| PDF download blank | Wait for jspdf to load (it's dynamically imported on first use) |
| `nvm: command not found` | Run `source ~/.bashrc` or open a new terminal |

---

## License

MIT
