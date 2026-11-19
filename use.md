# 🌐 Mini BitTorrent Tracker Simulator — Complete Project Analysis & Usage Guide

---

## 1. What This Project Is

This project simulates a **BitTorrent Tracker** — the central coordination server in a peer-to-peer file-sharing network. In real BitTorrent:

| Real BitTorrent Concept | Our Simulation |
|---|---|
| **Tracker** — server that knows which peers have which files | `Tracker` class in [tracker.py](file:///c:/Users/aadit/Desktop/dspro/tracker.py) |
| **Torrent** — a registered file being shared | `Torrent` dataclass, identified by a 40-hex-char `info_hash` |
| **Swarm** — all peers sharing one torrent | The `peers` dict inside each `Torrent` |
| **Seeder** — peer that has the complete file | Peer with `role = SEEDER`, `progress = 100%` |
| **Leecher** — peer still downloading | Peer with `role = LEECHER`, `progress < 100%` |
| **Announce** — peer tells tracker "I'm here" | The `announce()` method with STARTED/ANNOUNCE/COMPLETED/STOPPED events |
| **Scrape** — query tracker for stats | `GET /api/torrents/<hash>` and `GET /api/stats` |
| **Peer Timeout** — tracker drops inactive peers | `check_timeouts()` expires peers not seen in 120 seconds |

> [!IMPORTANT]
> This is a **simulation** — no actual file transfer or network communication happens. All data lives in-memory on the Flask server. This matches the assignment requirement: "Mini Bittorrent Tracker Simulator **(Without Networking)**".

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Web Dashboard  (Browser)                    │
│    HTML/CSS/JS  ·  Polls API every 2 seconds             │
│    Professional dark monitoring theme (SWARM)            │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP REST API (12 endpoints)
                       ▼
┌─────────────────────────────────────────────────────────┐
│          Flask Web Server  (app.py · 201 lines)          │
│    Request validation · JSON routing · Error handling     │
└──────────────────────┬──────────────────────────────────┘
                       │  Python method calls
                       ▼
┌─────────────────────────────────────────────────────────┐
│          Tracker Engine  (tracker.py · 412 lines)        │
│  ┌──────────────┐ ┌───────────┐ ┌─────────────────┐    │
│  │ Torrent       │ │ Peer      │ │ Event Log        │    │
│  │ Registry      │ │ Swarms    │ │ (incremental IDs │    │
│  │ {hash → info} │ │ {id → p}  │ │  capped at 200)  │    │
│  └──────────────┘ └───────────┘ └─────────────────┘    │
│  Thread-safe (Lock)  ·  Stats history snapshots          │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** Browser → HTTP request → Flask route → Tracker method → returns JSON → Browser renders

---

## 3. File-by-File Code Analysis

### 📄 [tracker.py](file:///c:/Users/aadit/Desktop/dspro/tracker.py) — Core Engine (412 lines)

This is the **brain** of the project. It contains:

**Helper Functions (lines 28–50):**
- `generate_info_hash()` — Creates a 20-byte (40 hex char) identifier for torrents, matching the [BitTorrent Protocol spec](https://www.bittorrent.org/beps/bep_0003.html)
- `generate_peer_id()` — Creates a 20-byte identifier for peers
- `parse_file_size("4.7 GB")` — Converts human-readable sizes to bytes

**Data Models (lines 53–124):**

| Class | Key Fields | Purpose |
|---|---|---|
| `PeerRole` | SEEDER, LEECHER | Enum for peer status |
| `Peer` | peer_id, name, role, port, uploaded, downloaded, left, progress, joined_at, last_seen | Full peer state mirroring the BTP announce parameters |
| `Torrent` | info_hash, name, file_size, file_size_bytes, peers | Registry entry with computed `seeders`/`leechers` properties |

**Tracker Class (lines 127–412):**

| Method | What It Does |
|---|---|
| `register_torrent(name, size)` | Adds a new file to the tracker registry |
| `remove_torrent(hash)` | Removes a torrent and its entire swarm |
| `announce(hash, name, role, event, peer_id)` | **Core protocol** — handles STARTED, ANNOUNCE, COMPLETED, STOPPED |
| `leave(hash, peer_id)` | Shortcut for STOPPED event |
| `promote_to_seeder(hash, peer_id)` | Shortcut for COMPLETED event |
| `update_progress(hash, peer_id, pct)` | Updates a leecher's download percentage |
| `simulate_progress_tick()` | Advances ALL leechers by a random 5–25% |
| `check_timeouts()` | Expires peers not seen in 120 seconds |
| `get_events(after_id)` | Returns events newer than a given ID |
| `get_stats()` | Returns aggregate counts |

> [!NOTE]
> Every public method acquires `self.lock` (a `threading.Lock`) before modifying state. This ensures thread safety even under concurrent API requests.

**The Announce Lifecycle** — the most important distributed systems concept:

```
Peer wants to download a file
            │
            ▼
    ┌── STARTED ──┐     New peer_id assigned
    │             │     Peer added to swarm as leecher
    │             ▼
    │      ANNOUNCE       Periodic heartbeat (updates last_seen)
    │         │           Keeps peer alive in tracker
    │         ▼
    │     COMPLETED       Download finished!
    │         │           Leecher → Seeder (progress = 100%)
    │         ▼
    └──── STOPPED         Peer leaves the swarm
                          Removed from tracker
```

If a peer doesn't send ANNOUNCE within 120 seconds → **EXPIRED** (auto-removed).

---

### 📄 [app.py](file:///c:/Users/aadit/Desktop/dspro/app.py) — Flask REST Server (201 lines)

**Validation** (lines 38–48):
```python
def require_json(*fields):
    # Returns (data, None) on success or (None, error_response) on failure
    # Checks: is it JSON? are required fields present and non-empty?
```

**12 API Endpoints:**

| Method | Endpoint | Status Codes | Description |
|---|---|---|---|
| `GET` | `/` | 200 | Serves the dashboard HTML |
| `GET` | `/api/stats` | 200 | Global counts: torrents, peers, seeders, leechers |
| `GET` | `/api/stats/history` | 200 | Stats snapshots over time (for charts) |
| `GET` | `/api/torrents` | 200 | List all torrents with full peer data |
| `POST` | `/api/torrents` | 201 / 400 | Register a new torrent |
| `GET` | `/api/torrents/<hash>` | 200 / 404 | Get single torrent details (scrape) |
| `DELETE` | `/api/torrents/<hash>` | 200 / 404 | Remove a torrent |
| `POST` | `/api/torrents/<hash>/announce` | 201/200/400/404 | Peer announce (STARTED/ANNOUNCE/COMPLETED/STOPPED) |
| `POST` | `/api/torrents/<hash>/leave` | 200 / 404 | Peer leaves swarm |
| `POST` | `/api/torrents/<hash>/promote` | 200 / 400 | Promote leecher → seeder |
| `POST` | `/api/torrents/<hash>/progress` | 200 / 400 | Update peer download progress |
| `POST` | `/api/simulate/progress` | 200 | Tick all leechers forward |
| `POST` | `/api/simulate/timeout` | 200 | Expire stale peers |
| `GET` | `/api/events?after_id=N` | 200 | Incremental event polling |

**Seed Data** (lines 17–33): On startup, 3 sample torrents with 7 peers are created so the dashboard isn't empty.

---

### 📄 [templates/index.html](file:///c:/Users/aadit/Desktop/dspro/templates/index.html) — Dashboard (403 lines)

Premium monitoring dashboard with these sections:

| Section | HTML ID | What It Shows |
|---|---|---|
| **Header** | `shell-header` | SWARM brand, tracker online status, simulation mode badge, refresh button |
| **Stats Grid** | `stats-grid` | 4 KPI cards with icons: Torrents, Peers, Seeders, Leechers |
| **Torrent Registry** | `panel-registry` | Data table of all torrents with search, seeder/leecher counts, copy/delete actions |
| **Swarm Details** | `panel-swarm` | Selected torrent's metadata chips + peer table with progress bars, roles, timestamps |
| **Tracker Controls** | `panel-controls` | Register torrent form, add peer form |
| **Peer Operations** | `panel-peer-ops` | Join, Leave, Progress, Timeout simulation buttons |
| **Scenario Presets** | `panel-scenarios` | Flash Crowd, Seeder Leaves, Full Lifecycle |
| **Event Stream** | `panel-events` | Live event log with pause/clear controls, event type badges |
| **Confirm Dialog** | `confirm-dialog` | Modal confirmation for torrent deletion |
| **Toasts** | `toasts` | Success/error notification popups |

---

### 📄 [static/style.css](file:///c:/Users/aadit/Desktop/dspro/static/style.css) — Styling (1057 lines)

Professional dark monitoring dashboard theme:

| Design Element | Implementation |
|---|---|
| **Color palette** | Deep navy backgrounds (`#0B1324`, `#121A32`), cyan accent (`#38BDF8`), green seeders (`#4ADE80`), red leechers (`#FB7185`) |
| **Typography** | System UI font stack, monospace for hashes/IDs |
| **Stat cards** | Colored icon badges, large numbers, animated value changes |
| **Data tables** | Fixed column widths, row hover, selected row highlight with cyan border |
| **Progress bars** | Animated fill width, green for seeders, cyan for leechers |
| **Role badges** | Pill-shaped with dot indicator, color-coded |
| **Event stream** | Color-coded rows by event type with slide-in animation |
| **Toasts** | Slide-in from right, auto-dismiss |
| **Responsive** | Grid collapses on small screens |

---

### 📄 [static/app.js](file:///c:/Users/aadit/Desktop/dspro/static/app.js) — Frontend Logic (691 lines)

| Section | What It Does |
|---|---|
| **State management** (lines 7–14) | Tracks selected torrent, last event ID, connection status, pause state |
| **DOM references** (lines 17–61) | Cached element references for performance |
| **API client** (lines 78–96) | `api()` with error handling, toast on failure, connection status tracking |
| **Formatting** (lines 126–152) | `fmtBytes()`, `fmtTime()`, `truncHash()`, `copyText()` |
| **Rendering** (lines 174–369) | `renderStats()`, `renderTorrents()`, `renderSwarm()`, `renderEvents()` |
| **Data refresh** (lines 373–429) | `refreshData()` fetches torrents + stats, `pollEvents()` polls every 2s, `startPolling()` / `stopPolling()` |
| **User actions** (lines 433–503) | `selectTorrent()`, `registerTorrent()`, `addPeer()`, `leavePeer()`, `promotePeer()`, `removeTorrent()` |
| **Simulation** (lines 507–540) | `simRandomJoin()`, `simRandomLeave()`, `simProgressTick()`, `simTimeout()` |
| **Scenarios** (lines 544–601) | `scenFlashCrowd()`, `scenSeederDepart()`, `scenLifecycle()` |
| **Event listeners** (lines 605–681) | Wires all buttons, Enter keys, dialog, pause/clear events |

---

## 4. How to Run

```bash
# Clone
git clone https://github.com/Aaditya210905/ds-project.git
cd ds-project

# Install
pip install -r requirements.txt    # just Flask

# Run
python app.py
```

Open **http://127.0.0.1:5000** → You'll see the dashboard with 3 pre-loaded torrents and 7 peers.

---

## 5. Step-by-Step Usage Guide

### 5.1 — Understanding the Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  SWARM · P2P Tracker Control Center    [● Online] [Sim Mode] 🔄 │
├──────────┬──────────┬──────────┬──────────────────────────────────┤
│ 3 Total  │ 7 Active │ 3        │ 4                                │
│ Torrents │ Peers    │ Seeders  │ Leechers                         │
├──────────────────────────────┬───────────────────────────────────┤
│  TORRENT REGISTRY            │  TRACKER CONTROLS                 │
│  [Search torrents…]          │  Register Torrent                 │
│  ┌─────────────────────────┐ │  [file name] [size]               │
│  │ ubuntu.iso  2S 2L  4T  │ │  [+ Register]                     │
│  │ notes.pdf   1S 1L  2T  │ │                                   │
│  │ dataset.zip 1S 0L  1T  │ │  Add Peer to Swarm                │
│  └─────────────────────────┘ │  [torrent ▼] [name] [role ▼]      │
│                              │  [+ Join Swarm]                    │
│  SWARM DETAILS               ├───────────────────────────────────┤
│  File: ubuntu.iso            │  PEER OPERATIONS                  │
│  Hash: a1b2c3d4…e5f6g7h8    │  [Join] [Leave]                   │
│  Seeders: 2  Leechers: 2    │  [Progress] [Timeout]             │
│  ┌─────────────────────────┐ ├───────────────────────────────────┤
│  │ Alice  Seeder   100.0%  │ │  SCENARIO PRESETS                 │
│  │ Bob    Seeder   100.0%  │ │  [Flash Crowd]                    │
│  │ Charlie Leecher  12.3%  │ │  [Seeder Leaves]                  │
│  │ Dave   Leecher   8.7%   │ │  [Full Lifecycle]                 │
│  └─────────────────────────┘ │                                   │
├──────────────────────────────┴───────────────────────────────────┤
│  EVENT STREAM                               [● Live] [⏸] [🗑]   │
│  11:20:30  STARTED   Peer 'Dave' joined 'ubuntu.iso' as leecher │
│  11:20:28  STARTED   Peer 'Charlie' joined 'ubuntu.iso' as ...  │
│  11:20:25  REGISTERED Torrent 'project-dataset.zip' registered  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 — Register a New Torrent

1. In the **Tracker Controls** panel (right side)
2. Enter file name: e.g., `movie.mkv`
3. Enter file size: e.g., `2.5 GB`
4. Click **"Register Torrent"**
5. ✅ Torrent appears in the registry table
6. ✅ Event stream shows: `REGISTERED — Torrent 'movie.mkv' (2.5 GB) registered`
7. ✅ "Total Torrents" stat card increments

### 5.3 — Add a Peer to a Swarm

1. In **Tracker Controls** → "Add Peer to Swarm"
2. Select a torrent from the dropdown
3. Enter peer name: e.g., `Alice`
4. Choose role: **Leecher** (downloading) or **Seeder** (has complete file)
5. Click **"Join Swarm"**
6. ✅ Toast notification: "Alice joined as leecher"
7. ✅ Seeder/Leecher counts update in the torrent table
8. ✅ Event: `STARTED — Peer 'Alice' joined 'movie.mkv' as leecher`

### 5.4 — View a Torrent's Swarm

1. **Click any row** in the Torrent Registry table
2. The row highlights with a cyan left border
3. **Swarm Details** panel below shows:
   - File name, size, full info hash (with copy button)
   - Seeder count, Leecher count, Total peers
   - **Peer table** with columns:
     - Peer name
     - Peer ID (truncated 40-char hash)
     - Role badge (green "Seeder" / cyan "Leecher")
     - Joined time, Last seen time
     - **Progress bar** (animated, color-coded)
     - Action buttons: "Leave" and "Complete ↑" (leechers only)

### 5.5 — Promote a Leecher to Seeder

This simulates a peer **finishing their download**:

1. View a torrent's swarm (click the torrent row)
2. Find a leecher in the peer table
3. Click the green **"Complete ↑"** button
4. ✅ Peer's role changes from "Leecher" to "Seeder"
5. ✅ Progress bar jumps to 100%
6. ✅ Event: `COMPLETED — Peer 'Alice' completed download of 'movie.mkv'`

### 5.6 — Remove a Peer

1. In the peer table, click the red **"Leave"** button
2. ✅ Peer disappears from the swarm
3. ✅ Counts update everywhere
4. ✅ Event: `STOPPED — Peer 'Alice' left 'movie.mkv'`

### 5.7 — Remove a Torrent

1. Click the **✕** button on a torrent row
2. A **confirmation dialog** appears: "Delete 'movie.mkv'?"
3. Click **"Delete Torrent"** to confirm
4. ✅ Torrent and all its peers are removed

---

## 6. Simulation Buttons (Peer Operations)

| Button | What Happens |
|---|---|
| **Join Peer** | A random-named peer joins a random torrent (60% leecher, 40% seeder) |
| **Leave Peer** | A random peer leaves a random swarm |
| **Simulate Progress** | ALL leechers advance by 5–25%. If anyone reaches 100% → auto-promoted to seeder |
| **Simulate Timeout** | Checks all peers' `last_seen` time. If > 120 seconds ago → expired and removed |

> [!TIP]
> Click **"Simulate Progress"** repeatedly during your demo to show leechers' progress bars growing in real time. When they hit 100%, they automatically become seeders — this is the COMPLETED event!

---

## 7. Scenario Presets

### 🌊 Flash Crowd
**What:** 6 leechers join the first torrent simultaneously  
**Demonstrates:** What happens when a popular file suddenly attracts many downloaders  
**Watch for:** Leecher count spikes, event stream fills with STARTED events

### 💨 Seeder Leaves
**What:** ALL seeders depart from a torrent  
**Demonstrates:** The problem of seeder shortage — leechers have nobody to download from  
**Watch for:** Seeder count drops to 0, only leechers remain

### 🔄 Full Lifecycle
**What:** Automated sequence with delays:
1. NewPeer joins as leecher (STARTED)
2. Progress advances: 30% → 55% → 80% → 95% (progress updates)
3. Download completes (COMPLETED → becomes seeder)
4. Peer leaves after seeding (STOPPED)

**Demonstrates:** The complete BitTorrent announce lifecycle  
**Watch for:** Progress bar smoothly filling, role changing, then peer disappearing

---

## 8. Event Stream

The bottom panel shows all tracker activity in real time:

| Event Type | Color | Meaning |
|---|---|---|
| `REGISTERED` | Blue | New torrent added to tracker |
| `REMOVED` | Red | Torrent deleted |
| `STARTED` | Green | Peer joined a swarm |
| `ANNOUNCE` | Gray | Peer sent periodic heartbeat |
| `COMPLETED` | Purple | Leecher finished downloading |
| `STOPPED` | Red | Peer left the swarm |
| `EXPIRED` | Orange | Peer timed out (no heartbeat) |

**Controls:**
- **● Live** indicator — shows polling is active
- **⏸ Pause** button — stops fetching new events
- **🗑 Clear** button — clears the event log display

---

## 9. REST API (for curl / advanced demo)

You can interact with the tracker via curl. Examples:

```bash
# List all torrents
curl http://127.0.0.1:5000/api/torrents | python -m json.tool

# Register a new torrent
curl -X POST http://127.0.0.1:5000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"name": "demo.zip", "file_size": "500 MB"}'

# Add a peer (STARTED announce)
curl -X POST http://127.0.0.1:5000/api/torrents/<HASH>/announce \
  -H "Content-Type: application/json" \
  -d '{"peer_name": "TestUser", "role": "leecher", "event": "STARTED"}'

# Update progress
curl -X POST http://127.0.0.1:5000/api/torrents/<HASH>/progress \
  -H "Content-Type: application/json" \
  -d '{"peer_id": "<PEER_ID>", "progress": 75}'

# Promote leecher to seeder
curl -X POST http://127.0.0.1:5000/api/torrents/<HASH>/promote \
  -H "Content-Type: application/json" \
  -d '{"peer_id": "<PEER_ID>"}'

# Get events since ID 50
curl http://127.0.0.1:5000/api/events?after_id=50
```

---

## 10. Distributed Systems Concepts Covered

| Concept | Where in Code | How to Demo |
|---|---|---|
| **Central Tracker** | `Tracker` class | The entire dashboard IS the tracker |
| **Peer-to-Peer Swarm** | `Torrent.peers` dict | Click a torrent to see its swarm |
| **Seeders vs Leechers** | `PeerRole` enum, role badges | Add peers with different roles |
| **Announce Protocol** | `announce()` with 4 events | Run "Full Lifecycle" scenario |
| **Protocol-spec IDs** | `generate_info_hash/peer_id` (20 bytes) | Hover peer IDs in the table |
| **Peer Failure / Timeout** | `check_timeouts()` | Click "Simulate Timeout" |
| **Download Progress** | `progress`, `downloaded`, `left` | Click "Simulate Progress" repeatedly |
| **Thread Safety** | `threading.Lock` | Multiple browser tabs work correctly |
| **Event-driven Updates** | Incremental event IDs + polling | Watch the Event Stream panel |
| **Scrape** | `GET /api/torrents/<hash>` | View any torrent's stats |

---

## 11. Suggested 5-Minute Demo Video Script

| Time | What to Do |
|---|---|
| **0:00–0:20** | Introduce your group (names, roll numbers, project title) |
| **0:20–1:20** | Explain what a BitTorrent tracker does: "It's a central server that keeps track of which peers have which files. Peers announce themselves to join a swarm. Seeders have the full file, leechers are still downloading." |
| **1:20–2:20** | Show the architecture diagram (draw it or show the ASCII art from README). Explain: tracker.py is the core, app.py is the Flask API, the browser polls every 2 seconds |
| **2:20–3:00** | **Live demo:** Show pre-loaded dashboard. Click a torrent. Point out seeders/leechers/progress bars |
| **3:00–3:30** | Register a new torrent. Add a peer as leecher. Show the event stream updating |
| **3:30–4:00** | Click **"Simulate Progress"** 3–4 times. Watch progress bars grow. Show when a leecher auto-completes |
| **4:00–4:20** | Run **"Full Lifecycle"** scenario. Narrate: "Watch NewPeer join, download, become a seeder, then leave" |
| **4:20–4:40** | Run **"Flash Crowd"** then **"Seeder Leaves"** — show swarm dynamics |
| **4:40–5:00** | Takeaway: "We learned how BitTorrent trackers coordinate peers without transferring files themselves. The tracker is the brain of the P2P network — it doesn't hold any file data, just metadata about who has what." |

---

## 12. Tests

The project includes 70 automated tests:

| Test File | Tests | What It Covers |
|---|---|---|
| [test_tracker.py](file:///c:/Users/aadit/Desktop/dspro/test_tracker.py) | 46 | ID generation, file parsing, torrent CRUD, announce lifecycle, progress, events, edge cases |
| [test_api.py](file:///c:/Users/aadit/Desktop/dspro/test_api.py) | 24 | All HTTP endpoints, status codes, validation (400/404), web UI loading |

Run them:
```bash
python test_tracker.py    # Core logic tests
python test_api.py        # API integration tests (starts a test server)
```
