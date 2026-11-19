# 🌐 Mini BitTorrent Tracker Simulator — Detailed Usage Guide

## 📖 What This Project Does

This project simulates a **BitTorrent Tracker** — the central server in a P2P (peer-to-peer) file sharing network. In real BitTorrent:

- A **Tracker** keeps a registry of which peers have which files
- **Seeders** are peers that have the complete file and share it
- **Leechers** are peers still downloading the file
- A **Swarm** is the group of all peers (seeders + leechers) sharing one file
- Peers **announce** to the tracker when they join/leave/finish downloading

Our simulator does all of this **without actual networking** — everything runs locally with a web dashboard.

---

## 🚀 Step 1: Setup & Run

### On Windows
```bash
cd c:\Users\aadit\Desktop\dspro
pip install -r requirements.txt
python app.py
```

### On Ubuntu/Linux
```bash
cd dspro/
pip3 install -r requirements.txt
python3 app.py
```

You'll see:
```
============================================================
  Mini BitTorrent Tracker Simulator
  Open http://127.0.0.1:5000 in your browser
============================================================
```

**Open http://127.0.0.1:5000** in your browser.

---

## 🖥️ Step 2: Understanding the Dashboard

The UI has **3 panels**:

```
┌──────────────┬─────────────────────────┬──────────────────┐
│   CONTROLS   │    TRACKED TORRENTS     │   EVENT LOG      │
│   (Left)     │    + SWARM VIEW         │   (Right)        │
│              │    (Center)             │                  │
└──────────────┴─────────────────────────┴──────────────────┘
```

### Left Panel — Tracker Controls
3 cards for interacting with the tracker:
1. **Register New Torrent** — Add a file to the tracker
2. **Add Peer to Swarm** — Make a peer join a torrent
3. **Simulate Actions** — Quick buttons for random events

### Center Panel — Tracked Torrents + Swarm View
- Shows all registered torrents with seeder/leecher counts
- Click a torrent to see its full **swarm** (list of peers)

### Right Panel — Real-Time Event Log
- Every action (join, leave, promote, register) appears here instantly
- Color-coded by event type

---

## 🎮 Step 3: How to Use (Step by Step)

### 3.1 — Register a Torrent

> [!NOTE]
> The app starts with 3 pre-loaded sample torrents for demo convenience.

1. In the left panel under **"➕ Register New Torrent"**
2. Enter a file name, e.g., `movie.mkv`
3. Enter a file size, e.g., `2.5 GB`
4. Click **"Register Torrent"**
5. ✅ The torrent appears in the center panel
6. ✅ An event appears in the right panel: *"Torrent 'movie.mkv' registered with tracker"*

### 3.2 — Add a Peer (Announce)

1. Under **"👤 Add Peer to Swarm"**
2. Select a torrent from the dropdown
3. Enter a peer name, e.g., `Alice`
4. Choose role:
   - **Leecher** = still downloading
   - **Seeder** = has the complete file
5. Click **"Join Swarm"**
6. ✅ The torrent's seeder/leecher count updates
7. ✅ Event log shows: *"Peer 'Alice' joined swarm for 'movie.mkv' as leecher"*

### 3.3 — View the Swarm

1. **Click on any torrent card** in the center panel
2. The bottom section shows all peers in that swarm
3. Each peer shows:
   - Name
   - Role (🟢 Seeder / 🔴 Leecher)
   - **Leave** button — peer exits the swarm
   - **Complete ↑** button (leechers only) — simulates finishing download

### 3.4 — Promote a Leecher to Seeder

This simulates a peer **finishing their download** and becoming a seeder:

1. Click a torrent to view its swarm
2. Find a leecher peer
3. Click the green **"Complete ↑"** button
4. ✅ The peer changes from 🔴 Leecher to 🟢 Seeder
5. ✅ Event: *"Peer 'Alice' completed download and became a seeder"*

### 3.5 — Remove a Peer (Leave)

1. In the swarm view, click the red **"Leave"** button on any peer
2. ✅ The peer disappears from the swarm
3. ✅ Seeder/leecher counts update
4. ✅ Event: *"Peer 'Alice' left swarm for 'movie.mkv'"*

### 3.6 — Remove a Torrent

1. Click the red **"Remove"** button on any torrent card
2. Confirm the prompt
3. ✅ Torrent and all its peers are removed from the tracker

---

## ⚡ Step 4: Quick Simulation Buttons

Under **"Simulate Actions"** in the left panel, there are 3 buttons for fast demo:

| Button | What it does |
|--------|-------------|
| **Random Peer Joins** | A random-named peer joins a random torrent (60% leecher, 40% seeder) |
| **Random Peer Leaves** | A random peer leaves a random swarm |
| **Random Leecher Completes Download** | A random leecher gets promoted to seeder |

> [!TIP]
> Click these rapidly during your demo video to show real-time swarm changes — the event log and counts update live!

---

## 🔗 Step 5: REST API Endpoints

The tracker also exposes a full REST API (useful for showing in demo):

| Method | Endpoint | Description | Example |
|--------|----------|-------------|---------|
| `GET` | `/api/torrents` | List all torrents | `curl http://127.0.0.1:5000/api/torrents` |
| `POST` | `/api/torrents` | Register a torrent | `curl -X POST -H "Content-Type: application/json" -d '{"name":"file.zip","file_size":"1 GB"}' http://127.0.0.1:5000/api/torrents` |
| `GET` | `/api/torrents/<hash>` | Get torrent details (scrape) | `curl http://127.0.0.1:5000/api/torrents/abc123` |
| `DELETE` | `/api/torrents/<hash>` | Remove a torrent | `curl -X DELETE http://127.0.0.1:5000/api/torrents/abc123` |
| `POST` | `/api/torrents/<hash>/announce` | Peer joins swarm | `curl -X POST -H "Content-Type: application/json" -d '{"peer_name":"Bob","role":"leecher"}' http://127.0.0.1:5000/api/torrents/abc123/announce` |
| `POST` | `/api/torrents/<hash>/leave` | Peer leaves swarm | `curl -X POST -H "Content-Type: application/json" -d '{"peer_id":"xyz"}' http://127.0.0.1:5000/api/torrents/abc123/leave` |
| `POST` | `/api/torrents/<hash>/promote` | Leecher → Seeder | `curl -X POST -H "Content-Type: application/json" -d '{"peer_id":"xyz"}' http://127.0.0.1:5000/api/torrents/abc123/promote` |
| `GET` | `/api/events` | Get event log | `curl http://127.0.0.1:5000/api/events` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Web Browser (UI)                  │
│         HTML/CSS/JS Dashboard + Polling (2s)        │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│               Flask Web Server (app.py)             │
│         Routes: /api/torrents, /announce, etc.      │
└──────────────────────┬──────────────────────────────┘
                       │  Python calls
                       ▼
┌─────────────────────────────────────────────────────┐
│              Tracker Engine (tracker.py)             │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Torrent     │  │  Peer    │  │  Event Log    │  │
│  │  Registry    │  │  Swarms  │  │  (in-memory)  │  │
│  │  {hash→info} │  │  {id→p}  │  │  [timestamped]│  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🎥 Suggested Demo Flow (for your 5-min video)

1. **0:00–0:20** — Introduce your group
2. **0:20–1:20** — Explain what a BitTorrent tracker does (use the architecture above)
3. **1:20–2:20** — Draw/show the architecture diagram
4. **2:20–4:20** — Live demo:
   - Show the pre-loaded torrents
   - Register a new torrent
   - Add peers as seeders and leechers
   - Click "Complete ↑" to promote a leecher
   - Click "Leave" to remove a peer
   - Use simulation buttons to show rapid swarm changes
   - Point out the real-time event log
5. **4:20–5:00** — Key takeaway: how P2P trackers coordinate without centralized file transfer
