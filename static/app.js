// ============================================================
//  Mini BitTorrent Tracker Simulator — Frontend Logic
// ============================================================

let selectedTorrent = null;
let lastEventTimestamp = 0;

// Random peer names for simulation
const RANDOM_NAMES = [
    "Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace",
    "Heidi", "Ivan", "Judy", "Karl", "Linda", "Mike", "Nancy",
    "Oscar", "Peggy", "Quinn", "Rita", "Steve", "Tina", "Uma",
    "Victor", "Wendy", "Xander", "Yara", "Zack"
];

// ==================== API CALLS ====================

async function apiCall(url, method = "GET", body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
}

// ==================== REFRESH DATA ====================

async function refreshTorrents() {
    const torrents = await apiCall("/api/torrents");
    renderTorrentList(torrents);
    updateTorrentDropdown(torrents);

    // Refresh swarm view if a torrent is selected
    if (selectedTorrent) {
        const torrent = torrents.find(t => t.info_hash === selectedTorrent);
        if (torrent) {
            renderSwarmView(torrent);
        } else {
            selectedTorrent = null;
            document.getElementById("swarm-title").textContent =
                "🔍 Select a torrent to view its swarm";
            document.getElementById("swarm-view").innerHTML = "";
        }
    }
}

async function pollEvents() {
    const events = await apiCall(`/api/events?since=${lastEventTimestamp}`);
    if (events.length > 0) {
        lastEventTimestamp = events[events.length - 1].timestamp;
        renderEvents(events);
        refreshTorrents();
    }
}

// ==================== RENDER FUNCTIONS ====================

function renderTorrentList(torrents) {
    const container = document.getElementById("torrent-list");

    if (torrents.length === 0) {
        container.innerHTML = '<p class="loading">No torrents registered yet.</p>';
        return;
    }

    container.innerHTML = torrents.map(t => `
        <div class="torrent-card ${t.info_hash === selectedTorrent ? 'selected' : ''}"
             onclick="selectTorrent('${t.info_hash}')">
            <div class="torrent-name">📄 ${escapeHtml(t.name)}</div>
            <div class="torrent-size">${escapeHtml(t.file_size)}</div>
            <div class="torrent-hash">hash: ${t.info_hash}</div>
            <div class="torrent-stats">
                <span class="stat-seeder">▲ ${t.seeder_count} seeders</span>
                <span class="stat-leecher">▼ ${t.leecher_count} leechers</span>
                <span class="stat-total">● ${t.total_peers} total</span>
            </div>
            <div class="torrent-actions">
                <button onclick="event.stopPropagation(); removeTorrent('${t.info_hash}')">
                    Remove
                </button>
            </div>
        </div>
    `).join("");
}

function renderSwarmView(torrent) {
    document.getElementById("swarm-title").textContent =
        `🐝 Swarm: ${torrent.name}`;

    const container = document.getElementById("swarm-view");

    if (torrent.peers.length === 0) {
        container.innerHTML = '<p class="loading">No peers in this swarm.</p>';
        return;
    }

    container.innerHTML = torrent.peers.map(p => `
        <div class="peer-card ${p.role}">
            <div class="peer-name">👤 ${escapeHtml(p.name)}</div>
            <span class="peer-role ${p.role}">
                ${p.role === 'seeder' ? '▲ Seeder' : '▼ Leecher'}
            </span>
            <div class="peer-actions">
                <button class="btn-leave"
                        onclick="leavePeer('${torrent.info_hash}', '${p.peer_id}')">
                    Leave
                </button>
                ${p.role === 'leecher' ? `
                <button class="btn-promote"
                        onclick="promotePeer('${torrent.info_hash}', '${p.peer_id}')">
                    Complete ↑
                </button>` : ''}
            </div>
        </div>
    `).join("");
}

function renderEvents(newEvents) {
    const container = document.getElementById("event-log");

    // Remove loading message on first events
    const loading = container.querySelector(".loading");
    if (loading) loading.remove();

    newEvents.forEach(e => {
        const div = document.createElement("div");
        div.className = `event-entry ${e.type}`;
        const time = new Date(e.timestamp * 1000).toLocaleTimeString();
        div.innerHTML = `
            <div class="event-time">${time}</div>
            <div class="event-msg">${escapeHtml(e.message)}</div>
        `;
        container.prepend(div);
    });

    // Keep only last 50 entries in DOM
    while (container.children.length > 50) {
        container.removeChild(container.lastChild);
    }
}

function updateTorrentDropdown(torrents) {
    const select = document.getElementById("peer-torrent");
    const currentVal = select.value;
    select.innerHTML = torrents.map(t =>
        `<option value="${t.info_hash}">${escapeHtml(t.name)}</option>`
    ).join("");
    if (currentVal && torrents.find(t => t.info_hash === currentVal)) {
        select.value = currentVal;
    }
}

// ==================== USER ACTIONS ====================

function selectTorrent(infoHash) {
    selectedTorrent = infoHash;
    refreshTorrents();
}

async function registerTorrent() {
    const name = document.getElementById("torrent-name").value.trim();
    const fileSize = document.getElementById("torrent-size").value.trim();
    if (!name || !fileSize) return alert("Please fill in both fields.");

    await apiCall("/api/torrents", "POST", { name, file_size: fileSize });
    document.getElementById("torrent-name").value = "";
    document.getElementById("torrent-size").value = "";
    await pollEvents();
}

async function addPeer() {
    const infoHash = document.getElementById("peer-torrent").value;
    const peerName = document.getElementById("peer-name").value.trim();
    const role = document.getElementById("peer-role").value;
    if (!infoHash || !peerName) return alert("Select a torrent and enter a peer name.");

    await apiCall(`/api/torrents/${infoHash}/announce`, "POST",
        { peer_name: peerName, role });
    document.getElementById("peer-name").value = "";
    await pollEvents();
}

async function leavePeer(infoHash, peerId) {
    await apiCall(`/api/torrents/${infoHash}/leave`, "POST", { peer_id: peerId });
    await pollEvents();
}

async function promotePeer(infoHash, peerId) {
    await apiCall(`/api/torrents/${infoHash}/promote`, "POST", { peer_id: peerId });
    await pollEvents();
}

async function removeTorrent(infoHash) {
    if (!confirm("Remove this torrent from the tracker?")) return;
    await apiCall(`/api/torrents/${infoHash}`, "DELETE");
    if (selectedTorrent === infoHash) selectedTorrent = null;
    await pollEvents();
}

// ==================== SIMULATION ====================

async function simulateRandomJoin() {
    const torrents = await apiCall("/api/torrents");
    if (torrents.length === 0) return alert("Register a torrent first!");
    const t = torrents[Math.floor(Math.random() * torrents.length)];
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const role = Math.random() > 0.6 ? "seeder" : "leecher";
    await apiCall(`/api/torrents/${t.info_hash}/announce`, "POST",
        { peer_name: name, role });
    await pollEvents();
}

async function simulateRandomLeave() {
    const torrents = await apiCall("/api/torrents");
    const withPeers = torrents.filter(t => t.total_peers > 0);
    if (withPeers.length === 0) return alert("No peers to remove!");
    const t = withPeers[Math.floor(Math.random() * withPeers.length)];
    const peer = t.peers[Math.floor(Math.random() * t.peers.length)];
    await apiCall(`/api/torrents/${t.info_hash}/leave`, "POST",
        { peer_id: peer.peer_id });
    await pollEvents();
}

async function simulateRandomPromote() {
    const torrents = await apiCall("/api/torrents");
    const withLeechers = torrents.filter(t => t.leecher_count > 0);
    if (withLeechers.length === 0) return alert("No leechers to promote!");
    const t = withLeechers[Math.floor(Math.random() * withLeechers.length)];
    const leechers = t.peers.filter(p => p.role === "leecher");
    const peer = leechers[Math.floor(Math.random() * leechers.length)];
    await apiCall(`/api/torrents/${t.info_hash}/promote`, "POST",
        { peer_id: peer.peer_id });
    await pollEvents();
}

// ==================== HELPERS ====================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INIT ====================

// Initial load
refreshTorrents();
pollEvents();

// Poll for new events every 2 seconds
setInterval(pollEvents, 2000);
