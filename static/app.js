// =============================================================
//  SWARM — P2P Tracker Control Center  ·  Frontend Application
// =============================================================

// ───── STATE ─────
let selectedTorrent = null;   // info_hash of currently selected torrent
let lastEventId     = 0;      // for reliable incremental event polling
let prevStats       = {};     // previous stat values for pulse detection

const NAMES = [
    "Alice","Bob","Charlie","Dave","Eve","Frank","Grace","Heidi",
    "Ivan","Judy","Karl","Linda","Mike","Nancy","Oscar","Peggy",
    "Quinn","Rita","Steve","Tina","Uma","Victor","Wendy","Xander",
    "Yara","Zack","Amit","Priya","Leo","Mia"
];

// ───── API UTILITY ─────

async function api(path, method = "GET", body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(path, opts);
        const data = await res.json();
        if (!res.ok) {
            toast(data.error || `Error ${res.status}`, "error");
            return null;
        }
        return data;
    } catch (e) {
        toast("Network error: " + e.message, "error");
        return null;
    }
}

// ───── TOAST NOTIFICATIONS ─────

function toast(msg, type = "success") {
    const c = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.classList.add("removing"); setTimeout(() => el.remove(), 300); }, 3000);
}

// ───── FORMATTING HELPERS ─────

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

function fmtBytes(b) {
    if (b <= 0) return "0 B";
    const u = ["B","KB","MB","GB","TB"];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
}

function fmtTime(ts) { return new Date(ts * 1000).toLocaleTimeString(); }

function truncHash(h) {
    if (!h || h.length <= 16) return h;
    return h.slice(0, 8) + "…" + h.slice(-8);
}

// ───── RENDER: STATS ─────

function renderStats(stats) {
    setStatVal("stat-torrents", stats.total_torrents);
    setStatVal("stat-peers",    stats.total_peers);
    setStatVal("stat-seeders",  stats.total_seeders);
    setStatVal("stat-leechers", stats.total_leechers);
    prevStats = stats;
}

function setStatVal(id, val) {
    const el = document.getElementById(id);
    const old = parseInt(el.textContent);
    el.textContent = val;
    if (!isNaN(old) && old !== val) {
        el.classList.remove("pulse");
        void el.offsetWidth;          // reflow to restart animation
        el.classList.add("pulse");
    }
}

// ───── RENDER: TORRENT TABLE ─────

function renderTorrents(torrents) {
    const tb = document.getElementById("torrent-tbody");
    if (!torrents.length) {
        tb.innerHTML = `<tr><td colspan="7" class="empty-msg">No torrents registered</td></tr>`;
        return;
    }
    tb.innerHTML = torrents.map(t => `
        <tr class="${t.info_hash === selectedTorrent ? 'selected' : ''}"
            onclick="selectTorrent('${t.info_hash}')">
            <td class="cell-name">${esc(t.name)}</td>
            <td>${esc(t.file_size)}</td>
            <td class="cell-hash" title="${t.info_hash}">${truncHash(t.info_hash)}</td>
            <td class="center cell-count green">${t.seeder_count}</td>
            <td class="center cell-count red">${t.leecher_count}</td>
            <td class="center cell-count blue">${t.total_peers}</td>
            <td class="center">
                <button class="act-btn remove"
                        onclick="event.stopPropagation();removeTorrent('${t.info_hash}')">✕</button>
            </td>
        </tr>`).join("");

    // update dropdown
    const sel = document.getElementById("sel-torrent");
    const cur = sel.value;
    sel.innerHTML = torrents.map(t =>
        `<option value="${t.info_hash}">${esc(t.name)}</option>`).join("");
    if (cur && torrents.find(t => t.info_hash === cur)) sel.value = cur;
}

// ───── RENDER: SWARM VIEW ─────

function renderSwarm(torrent) {
    if (!torrent) {
        document.getElementById("swarm-title").textContent = "🐝 Select a torrent to view its swarm";
        document.getElementById("swarm-hash").textContent = "";
        document.getElementById("swarm-meta").style.display = "none";
        document.getElementById("peer-table-wrap").style.display = "none";
        document.getElementById("empty-swarm").style.display = "block";
        document.getElementById("empty-swarm").textContent = "Select a torrent above to inspect its peer swarm.";
        return;
    }

    document.getElementById("swarm-title").textContent = `🐝 Swarm: ${torrent.name}`;
    document.getElementById("swarm-hash").textContent = torrent.info_hash;

    // meta bar
    const meta = document.getElementById("swarm-meta");
    meta.style.display = "flex";
    document.getElementById("sw-seeders").textContent = torrent.seeder_count;
    document.getElementById("sw-leechers").textContent = torrent.leecher_count;

    // ratio bar
    const total = torrent.seeder_count + torrent.leecher_count;
    const pct = total > 0 ? (torrent.seeder_count / total * 100) : 0;
    document.getElementById("ratio-fill").style.width = pct + "%";

    if (!torrent.peers.length) {
        document.getElementById("peer-table-wrap").style.display = "none";
        document.getElementById("empty-swarm").style.display = "block";
        document.getElementById("empty-swarm").textContent = "No peers in this swarm.";
        return;
    }

    document.getElementById("empty-swarm").style.display = "none";
    document.getElementById("peer-table-wrap").style.display = "block";

    const tb = document.getElementById("peer-tbody");
    tb.innerHTML = torrent.peers.map(p => {
        const isSeed = p.role === "seeder";
        const progClass = isSeed ? "green" : "blue";
        return `<tr>
            <td class="cell-name">👤 ${esc(p.name)}</td>
            <td class="cell-hash" title="${p.peer_id}">${truncHash(p.peer_id)}</td>
            <td class="center">${p.port}</td>
            <td class="center"><span class="status ${p.role}">${isSeed ? "▲ Seeder" : "▼ Leecher"}</span></td>
            <td class="progress-cell">
                <div class="progress-bar">
                    <div class="progress-fill ${progClass}" style="width:${p.progress}%"></div>
                    <span class="progress-text">${p.progress}%</span>
                </div>
            </td>
            <td class="right">${fmtBytes(p.downloaded)}</td>
            <td class="right">${fmtBytes(p.uploaded)}</td>
            <td class="center" style="white-space:nowrap">
                <button class="act-btn leave"
                        onclick="leavePeer('${torrent.info_hash}','${p.peer_id}')">Leave</button>
                ${!isSeed ? `<button class="act-btn promote"
                        onclick="promotePeer('${torrent.info_hash}','${p.peer_id}')">Complete ↑</button>` : ""}
            </td>
        </tr>`;
    }).join("");
}

// ───── RENDER: EVENT LOG ─────

function renderEvents(events) {
    const log = document.getElementById("event-log");
    // clear placeholder
    if (log.querySelector(".empty-msg")) log.innerHTML = "";

    events.forEach(e => {
        const d = document.createElement("div");
        d.className = `ev ${e.type}`;
        d.innerHTML = `<span class="ev-time">${fmtTime(e.timestamp)}</span>
            <span class="ev-type">${e.type.replace("PEER_","").replace("TORRENT_","")}</span>
            <div class="ev-msg">${esc(e.message)}</div>`;
        log.prepend(d);
    });

    // cap DOM entries
    while (log.children.length > 60) log.removeChild(log.lastChild);

    document.getElementById("ev-count").textContent = lastEventId;
}

// ───── DATA REFRESH ─────

async function refresh() {
    const torrents = await api("/api/torrents");
    if (!torrents) return;
    renderTorrents(torrents);

    const stats = await api("/api/stats");
    if (stats) renderStats(stats);

    if (selectedTorrent) {
        const t = torrents.find(x => x.info_hash === selectedTorrent);
        renderSwarm(t || null);
        if (!t) selectedTorrent = null;
    }
}

async function pollEvents() {
    const events = await api(`/api/events?after_id=${lastEventId}`);
    if (events && events.length) {
        lastEventId = events[events.length - 1].event_id;
        renderEvents(events);
        await refresh();
    }
}

// ───── USER ACTIONS ─────

function selectTorrent(ih) {
    selectedTorrent = ih;
    refresh();
}

async function registerTorrent() {
    const name = document.getElementById("inp-tname").value.trim();
    const size = document.getElementById("inp-tsize").value.trim();
    if (!name || !size) return toast("Fill in both fields", "error");
    const r = await api("/api/torrents", "POST", { name, file_size: size });
    if (r) { document.getElementById("inp-tname").value = ""; document.getElementById("inp-tsize").value = ""; toast("Torrent registered"); }
    await pollEvents();
}

async function addPeer() {
    const ih   = document.getElementById("sel-torrent").value;
    const name = document.getElementById("inp-pname").value.trim();
    const role = document.getElementById("sel-role").value;
    if (!ih || !name) return toast("Select a torrent and enter a peer name", "error");
    const r = await api(`/api/torrents/${ih}/announce`, "POST", { peer_name: name, role, event: "STARTED" });
    if (r) { document.getElementById("inp-pname").value = ""; toast(`${name} joined as ${role}`); }
    await pollEvents();
}

async function leavePeer(ih, pid) {
    await api(`/api/torrents/${ih}/leave`, "POST", { peer_id: pid });
    await pollEvents();
}

async function promotePeer(ih, pid) {
    const r = await api(`/api/torrents/${ih}/promote`, "POST", { peer_id: pid });
    if (r) toast("Peer promoted to seeder");
    await pollEvents();
}

async function removeTorrent(ih) {
    if (!confirm("Remove this torrent?")) return;
    await api(`/api/torrents/${ih}`, "DELETE");
    if (selectedTorrent === ih) { selectedTorrent = null; renderSwarm(null); }
    await pollEvents();
}

// ───── SIMULATION ─────

async function simRandomJoin() {
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[Math.floor(Math.random() * torrents.length)];
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const role = Math.random() > 0.6 ? "seeder" : "leecher";
    await api(`/api/torrents/${t.info_hash}/announce`, "POST", { peer_name: name, role, event: "STARTED" });
    await pollEvents();
}

async function simRandomLeave() {
    const torrents = await api("/api/torrents");
    if (!torrents) return;
    const pool = torrents.filter(t => t.total_peers > 0);
    if (!pool.length) return toast("No peers to remove", "error");
    const t = pool[Math.floor(Math.random() * pool.length)];
    const p = t.peers[Math.floor(Math.random() * t.peers.length)];
    await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: p.peer_id });
    await pollEvents();
}

async function simProgressTick() {
    const r = await api("/api/simulate/progress", "POST");
    if (r && r.promoted.length) toast(`${r.promoted.join(", ")} completed download!`);
    else if (r) toast("Progress advanced for all leechers");
    await pollEvents();
}

async function simTimeout() {
    const r = await api("/api/simulate/timeout", "POST");
    if (r && r.expired.length) toast(`${r.expired.length} peer(s) timed out`, "error");
    else toast("No peers timed out");
    await pollEvents();
}

// ───── SCENARIOS ─────

async function scenFlashCrowd() {
    toast("⚡ Flash crowd: 6 leechers joining…");
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[0];
    for (let i = 0; i < 6; i++) {
        const name = "Peer-" + String.fromCharCode(65 + i + Math.floor(Math.random() * 10));
        await api(`/api/torrents/${t.info_hash}/announce`, "POST",
            { peer_name: name, role: "leecher", event: "STARTED" });
    }
    await pollEvents();
    toast("Flash crowd joined!");
}

async function scenSeederDepart() {
    const torrents = await api("/api/torrents");
    if (!torrents) return;
    const t = torrents.find(x => x.seeder_count > 0) || torrents[0];
    if (!t) return toast("No torrents", "error");
    const seeders = t.peers.filter(p => p.role === "seeder");
    if (!seeders.length) return toast("No seeders to remove", "error");
    toast("💨 All seeders departing…");
    for (const s of seeders) {
        await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: s.peer_id });
    }
    await pollEvents();
    toast("All seeders left the swarm!");
}

async function scenLifecycle() {
    toast("🔄 Running full lifecycle…");
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[0];

    // 1) New peer joins as leecher
    const r = await api(`/api/torrents/${t.info_hash}/announce`, "POST",
        { peer_name: "NewPeer", role: "leecher", event: "STARTED" });
    if (!r) return;
    const pid = r.peer_id;
    await pollEvents();

    // 2) Progress ticks
    for (const pct of [30, 55, 80, 95]) {
        await delay(600);
        await api(`/api/torrents/${t.info_hash}/progress`, "POST", { peer_id: pid, progress: pct });
        await pollEvents();
    }

    // 3) Complete
    await delay(600);
    await api(`/api/torrents/${t.info_hash}/promote`, "POST", { peer_id: pid });
    await pollEvents();

    // 4) Leave after seeding
    await delay(800);
    await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: pid });
    await pollEvents();
    toast("Lifecycle complete!");
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ───── INIT ─────

(async () => {
    await refresh();
    await pollEvents();
    setInterval(pollEvents, 2000);
})();
