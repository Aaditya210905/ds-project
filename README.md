# Mini BitTorrent Tracker Simulator (Without Networking)

## 📌 Project Description

A simplified BitTorrent tracker simulator that demonstrates core P2P concepts — **trackers, swarms, seeders, and leechers** — without actual networking. The tracker maintains a registry of torrent files and their associated peer swarms. Peers can announce (join), leave, or be promoted from leecher to seeder when they complete a download. All swarm changes are displayed in real time through a professional monitoring dashboard.

> **Simulation note:** This project simulates tracker behaviour locally. There is no actual peer-to-peer data transfer or network communication between peers. All peers, torrents, and events exist in-memory on the server.

## 🏗️ Architecture

The system follows a **client-server architecture** modelled after a real BitTorrent tracker. A **Flask REST API** (`app.py`) acts as the central tracker, exposing announce/scrape endpoints. The **Tracker engine** (`tracker.py`) manages an in-memory registry mapping 40-character `info_hash` values to their peer swarms, supporting the full announce lifecycle (STARTED → ANNOUNCE → COMPLETED → STOPPED) with upload/download statistics, progress tracking, and peer timeout expiry. A **web dashboard** (HTML/CSS/JS) polls the tracker API every 2 seconds to reflect real-time swarm changes.

```
┌─────────────────────────────────────────────────────┐
│                 Web Dashboard (Browser)              │
│        HTML/CSS/JS  ·  Polls API every 2 seconds     │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│             Flask Web Server  (app.py)               │
│     Validation · Routing · JSON responses            │
└──────────────────────┬──────────────────────────────┘
                       │  Python calls
                       ▼
┌─────────────────────────────────────────────────────┐
│            Tracker Engine  (tracker.py)               │
│  ┌──────────────┐ ┌───────────┐ ┌────────────────┐  │
│  │ Torrent       │ │ Peer      │ │ Event Log      │  │
│  │ Registry      │ │ Swarms    │ │ (incremental   │  │
│  │ {hash → info} │ │ {id → p}  │ │  IDs, capped)  │  │
│  └──────────────┘ └───────────┘ └────────────────┘  │
│  Thread-safe (Lock)  ·  Stats history snapshots      │
└─────────────────────────────────────────────────────┘
```

## 🚀 How to Run

### Prerequisites

- Python 3.8+ (tested with Python 3.12 and 3.13)
- pip

### Setup & Run

```bash
# Clone the repository
git clone https://github.com/Aaditya210905/ds-project.git
cd ds-project

# Install dependencies
pip install -r requirements.txt

# Start the tracker
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

### On Ubuntu / Linux

```bash
git clone https://github.com/Aaditya210905/ds-project.git
cd ds-project
pip3 install -r requirements.txt
python3 app.py
```

## 📖 Usage

| Feature | How |
|---------|-----|
| **Register a torrent** | Enter file name + size in the sidebar, click "Register" |
| **Add a peer** | Select torrent, enter peer name, choose role, click "Join Swarm" |
| **View swarm** | Click any torrent row to see its peers with progress bars |
| **Promote leecher → seeder** | Click the green "Complete ↑" button on a leecher |
| **Remove a peer** | Click the red "Leave" button on any peer |
| **Simulate random events** | Use the "Simulate" buttons: Join, Leave, Progress, Timeout |
| **Run scenarios** | Flash Crowd (mass join), Seeder Departure, Full Lifecycle |
| **Watch events** | The Event Stream panel shows all activity in real time |

## 🗂️ File Structure

```
ds-project/
├── app.py              # Flask web server with REST API & validation
├── tracker.py          # Core tracker engine (Tracker, Torrent, Peer)
├── requirements.txt    # Python dependencies (flask)
├── README.md           # Project documentation
├── group_details.txt   # Group info (number, names, roll numbers)
├── templates/
│   └── index.html      # Dashboard template
└── static/
    ├── style.css       # Professional dark monitoring theme
    └── app.js          # Frontend (API client, rendering, simulation, scenarios)
```

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Global tracker statistics |
| `GET` | `/api/torrents` | List all tracked torrents |
| `POST` | `/api/torrents` | Register a new torrent |
| `GET` | `/api/torrents/<hash>` | Get torrent details (scrape) |
| `DELETE` | `/api/torrents/<hash>` | Remove a torrent |
| `POST` | `/api/torrents/<hash>/announce` | Peer announce (STARTED / ANNOUNCE / COMPLETED / STOPPED) |
| `POST` | `/api/torrents/<hash>/leave` | Peer leaves the swarm |
| `POST` | `/api/torrents/<hash>/promote` | Promote leecher → seeder |
| `POST` | `/api/torrents/<hash>/progress` | Update peer download progress |
| `POST` | `/api/simulate/progress` | Advance all leechers' progress |
| `POST` | `/api/simulate/timeout` | Expire stale peers |
| `GET` | `/api/events?after_id=N` | Get events after a given ID |

## 📚 Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **BitTorrent Tracker** | Central server coordinating peers (`tracker.py`) |
| **Swarm** | Per-torrent peer group with dynamic membership |
| **Seeders / Leechers** | Role-based peer classification with status badges |
| **Announce Protocol** | STARTED → periodic ANNOUNCE → COMPLETED → STOPPED lifecycle |
| **Info Hash (20-byte)** | Protocol-compatible 40-hex-char identifiers |
| **Peer Identity** | Stable peer IDs with port, uploaded, downloaded, left fields |
| **Scrape** | Query tracker for swarm statistics |
| **Peer Timeout** | Stale peers expired after inactivity window |
| **Download Progress** | Simulated byte-level download tracking |

## ⚠️ Known Limitations

- **No actual networking** — all peers and transfers are simulated in-memory
- **No file chunking / piece selection** — progress is a single percentage
- **Single-server** — no distributed tracker or DHT
- **In-memory storage** — data is lost on server restart
- **No authentication** — open tracker (matches the simulation scope)
