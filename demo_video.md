# 🎬 Demo Video Script — Mini BitTorrent Tracker Simulator

> **Total duration:** ~4:50  
> **Format:** Screen recording with voiceover  
> **Tip:** Have the app already running at `http://127.0.0.1:5000` before you start recording.

---

## 🟦 Segment 1 — Introduction (0:00 – 0:20)

> [!IMPORTANT]
> **Show:** A title slide (PowerPoint/Google Slides) or just the dashboard header with your group info overlaid.

### Script

> *"Hello, this is our group project for Distributed Systems 2026.*
>
> *Our project is **Mini BitTorrent Tracker Simulator — Without Networking**.*
>
> *Our team members are:*
> - *Aaditya Meghrajani — 241020401*
> - *Abhiudai Singh — 241020403*
> - *Abhinav Srivastav — 241020404*
> - *Aditya Tiwari — 241020405"*

**Duration:** ~20 seconds

---

## 🟦 Segment 2 — What the System Does (0:20 – 1:20)

> [!IMPORTANT]
> **Show:** The dashboard overview (stats cards, torrent table, event stream). Slowly scroll through it.

### Script

> *"In a real BitTorrent network, a **tracker** is the central server that keeps track of which peers are sharing a file. It doesn't transfer files itself — it simply maintains a **registry** of torrents and their associated **peer swarms**.*
>
> *Our simulator recreates this tracker behaviour entirely in-memory, without any actual networking.*
>
> *The system has three main parts:*
>
> *First, a **Tracker Engine** written in Python that manages torrent registration, peer swarms, and the announce lifecycle — STARTED, ANNOUNCE, COMPLETED, and STOPPED — just like the real BitTorrent protocol.*
>
> *Second, a **Flask REST API** that exposes endpoints for registering torrents, announcing peers, leaving swarms, and querying statistics.*
>
> *Third, a **real-time web dashboard** that polls the API every two seconds to display swarm state, peer progress, and an event stream — giving us a live monitoring view of tracker activity.*
>
> *The core functionality covers three things: mapping files to their peer lists, simulating peers joining and leaving swarms, and tracking real-time seeder and leecher statistics."*

**Duration:** ~60 seconds

---

## 🟦 Segment 3 — Architecture Diagram (1:20 – 2:20)

> [!IMPORTANT]
> **Show:** The ASCII architecture diagram from the README (you can display it in a terminal, or draw it on paper/whiteboard, or show a slide). Point to each component as you explain.

### Diagram to show:

```
┌─────────────────────────────────────────────────────┐
│                 Web Dashboard (Browser)             │
│        HTML/CSS/JS  ·  Polls API every 2 seconds    │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│             Flask Web Server  (app.py)              │
│     Validation · Routing · JSON responses           │
└──────────────────────┬──────────────────────────────┘
                       │  Python calls
                       ▼
┌─────────────────────────────────────────────────────┐
│            Tracker Engine  (tracker.py)             │
│  ┌──────────────┐ ┌───────────┐ ┌────────────────┐  │
│  │ Torrent      │ │ Peer      │ │ Event Log      │  │
│  │ Registry     │ │ Swarms    │ │ (incremental   │  │
│  │ {hash → info}│ │ {id → p}  │ │  IDs, capped)  │  │
│  └──────────────┘ └───────────┘ └────────────────┘  │
│  Thread-safe (Lock)  ·  Stats history snapshots     │
└─────────────────────────────────────────────────────┘
```

### Script

> *"Here's our architecture. It follows a standard **three-tier client-server model** inspired by how a real BitTorrent tracker works.*
>
> *At the top, we have the **Web Dashboard** — this is what you see in the browser. It's built with HTML, CSS, and JavaScript, and it polls the backend API every two seconds to get live data.*
>
> *In the middle, we have the **Flask Web Server** — `app.py`. This handles HTTP routing, request validation, and returns JSON responses. It exposes over twelve REST API endpoints — for registering torrents, announcing peers, scraping statistics, and simulating events.*
>
> *At the bottom is the **Tracker Engine** — `tracker.py`. This is the core of the project. It has three main data structures: a **Torrent Registry** that maps 40-character info hashes to file metadata, **Peer Swarms** that track each peer's role, progress, upload and download stats, and an **Event Log** with incremental IDs for reliable event streaming.*
>
> *The entire tracker engine is **thread-safe** using Python's threading Lock, so concurrent API requests don't corrupt the shared state."*

**Duration:** ~60 seconds

---

## 🟦 Segment 4 — Live Demo (2:20 – 4:20)

> [!IMPORTANT]
> **Show:** The running dashboard in the browser. Perform each action live and narrate what's happening.

### Part A — Overview (~15 sec)

> *"The dashboard loads with three pre-seeded demo torrents. At the top, you can see the overview cards showing 3 total torrents, 7 active peers, 4 seeders, and 3 leechers."*

**Action:** Point cursor at the stats cards.

---

### Part B — Register a New Torrent (~20 sec)

> *"Let me register a new torrent. I'll type a file name — 'my-project.zip' — and a size, say '500 MB'. Click Register."*

**Action:** Type `my-project.zip` in file name, `500 MB` in size, click **Register Torrent**.

> *"The torrent appears in the registry with a unique 40-character info hash — this matches the standard 20-byte identifier used in the real BitTorrent protocol. The total torrent count updates to 4."*

---

### Part C — Add Peers to the Swarm (~25 sec)

> *"Now let me add some peers. I'll select 'my-project.zip', add a peer named 'Alice' as a Seeder... and another peer 'Bob' as a Leecher."*

**Action:** Select the new torrent → type `Alice` → select Seeder → click **Join Swarm**. Repeat with `Bob` as Leecher.

> *"If I click on the torrent row, the swarm details panel below shows both peers. Alice is at 100% as a seeder, and Bob is downloading with a progress bar."*

---

### Part D — Simulate Progress & Promote (~25 sec)

> *"Let me simulate Bob's download progressing. I'll click the Simulate Progress button a few times."*

**Action:** Click **Sim Progress** button 2–3 times. Show Bob's progress bar increasing.

> *"Bob's progress is going up — 30%, 55%, now it's close to 100%. Once he finishes, I can promote him to a seeder by clicking the green Complete button."*

**Action:** Click **Complete ↑** on Bob.

> *"Bob is now a seeder — his badge changed from Leecher to Seeder, and the stats updated accordingly."*

---

### Part E — Run a Scenario (~20 sec)

> *"The dashboard also includes pre-built simulation scenarios. Let me run the 'Flash Crowd' scenario — this simulates five peers suddenly joining a swarm at once, which is a common pattern in real torrents."*

**Action:** Click the **Flash Crowd** scenario button.

> *"You can see multiple peers joined instantly. The event stream on the right shows all the PEER_JOINED events with timestamps."*

---

### Part F — Event Stream & Remove (~15 sec)

> *"The Event Stream panel records every tracker action — joins, leaves, promotions, registrations — with incremental event IDs. I can also remove a peer by clicking the red Leave button."*

**Action:** Click **Leave** on any peer. Point to the event stream.

> *"The peer is removed and a PEER_LEFT event is logged immediately."*

**Duration:** ~2 minutes total

---

## 🟦 Segment 5 — What We Learned (4:20 – 5:00)

> [!IMPORTANT]
> **Show:** Come back to the full dashboard overview, or switch to a closing slide.

### Script

> *"Through this project, we learned several key distributed systems concepts:*
>
> *First, we understood the **role of a tracker** in a BitTorrent network — it's not a file server, it's a coordination point that maps files to their peer swarms.*
>
> *Second, we implemented the **announce protocol lifecycle** — how peers go through STARTED, periodic ANNOUNCE, COMPLETED, and STOPPED states — which is fundamental to how trackers manage swarm membership.*
>
> *Third, we dealt with **thread safety** and **concurrent state management** — using locks to ensure multiple API requests don't corrupt shared data, which is a real challenge in distributed systems.*
>
> *And finally, we learned about **real-time event streaming** — using incremental event IDs instead of timestamps to reliably deliver events to clients, avoiding the problem of missed events with duplicate timestamps.*
>
> *Thank you for watching."*

**Duration:** ~40 seconds

---

## 📋 Quick Checklist Before Recording

- [ ] App is running: `python app.py` → open `http://127.0.0.1:5000`
- [ ] Browser is in **full screen** (F11) for a clean look
- [ ] Screen recorder is set to capture browser + audio
- [ ] Have a title slide ready (group name, project title, member names)
- [ ] Practice once before the final take
- [ ] Keep total video under **5 minutes**

> [!TIP]
> You don't need to memorize the script word-for-word. Read it naturally — paraphrasing is totally fine as long as you hit the key points in each segment.
