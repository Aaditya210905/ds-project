# Mini BitTorrent Tracker Simulator (Without Networking)

## 📌 Project Description

A simplified BitTorrent tracker simulator that demonstrates core P2P concepts — **trackers, swarms, seeders, and leechers** — without actual networking. The tracker maintains a registry of torrent files and their associated peer swarms. Peers can join (announce), leave, or be promoted from leecher to seeder when they complete a download. All swarm changes are displayed in real-time through a web-based dashboard.

## 🏗️ Architecture (3–5 lines)

The system follows a **client-server architecture** mimicking a real BitTorrent tracker. A **Flask REST API** acts as the central tracker, maintaining an in-memory registry mapping torrent `info_hash` values to their peer swarms. The **Tracker** module manages torrent registration, peer announce/leave/promote operations, and an event log. A **web UI** (HTML/CSS/JS) polls the tracker API every 2 seconds to reflect real-time changes in seeder/leecher counts, providing a live dashboard of the swarm state.

## 🚀 How to Run

### Prerequisites
- Python 3.8+ (tested on Python 3.13)
- pip

### Installation & Run

```bash
# 1. Navigate to the project directory
cd dspro/

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the tracker
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

### On Ubuntu / Linux

```bash
cd dspro/
pip3 install -r requirements.txt
python3 app.py
```

## 📖 Usage

1. **Register Torrents** — Add new torrent files to the tracker
2. **Add Peers** — Simulate peers joining a torrent swarm as seeders or leechers
3. **Simulate Actions** — Use the quick buttons to simulate random peers joining, leaving, or completing downloads
4. **View Swarm** — Click any torrent to see its detailed peer swarm
5. **Event Log** — Watch real-time events on the right panel

## 🗂️ File Structure

```
dspro/
├── tracker.py          # Core tracker logic (Tracker, Torrent, Peer classes)
├── app.py              # Flask web server with REST API
├── requirements.txt    # Python dependencies
├── README.md           # Project documentation
├── group_details.txt   # Group info (number, names, roll numbers)
├── templates/
│   └── index.html      # Web UI template
└── static/
    ├── style.css       # Dashboard styling
    └── app.js          # Frontend JavaScript (API calls, rendering, simulation)
```

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/torrents` | List all tracked torrents |
| POST | `/api/torrents` | Register a new torrent |
| GET | `/api/torrents/<hash>` | Get torrent details (scrape) |
| DELETE | `/api/torrents/<hash>` | Remove a torrent |
| POST | `/api/torrents/<hash>/announce` | Peer joins the swarm |
| POST | `/api/torrents/<hash>/leave` | Peer leaves the swarm |
| POST | `/api/torrents/<hash>/promote` | Promote leecher to seeder |
| GET | `/api/events?since=<ts>` | Get event log since timestamp |

## 📚 Concepts Demonstrated

- **BitTorrent Tracker**: Central server that coordinates peers in a P2P network
- **Swarm**: The group of all peers sharing a particular torrent
- **Seeders**: Peers that have the complete file and upload to others
- **Leechers**: Peers that are still downloading the file
- **Announce**: The process by which peers register with the tracker
- **Scrape**: Querying the tracker for swarm statistics
