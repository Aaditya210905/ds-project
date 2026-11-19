// =============================================================
//  SWARM — P2P Tracker Control Center  ·  Frontend Application
//  Premium dark dashboard · Vanilla JS · Flask API backend
// =============================================================

// ───── STATE ─────
const state = {
    selectedTorrent: null,      // info_hash of currently selected torrent
    lastEventId: 0,             // for reliable incremental event polling
    prevStats: {},              // previous stat values for animation triggers
    refreshing: false,          // guard against overlapping data refreshes
    eventsPaused: false,        // live event stream pause toggle
    connOnline: true,           // backend connectivity status
};

// ───── DOM REFERENCES ─────
const els = {
    connDot: document.getElementById("conn-dot"),
    connText: document.getElementById("conn-text"),
    connStatus: document.getElementById("conn-status"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnRegister: document.getElementById("btn-register"),
    btnAddPeer: document.getElementById("btn-add-peer"),
    btnCopyHash: document.getElementById("btn-copy-hash"),
    statTorrents: document.getElementById("stat-torrents"),
    statPeers: document.getElementById("stat-peers"),
    statSeeders: document.getElementById("stat-seeders"),
    statLeechers: document.getElementById("stat-leechers"),
    torrentTbody: document.getElementById("torrent-tbody"),
    registryEmpty: document.getElementById("registry-empty"),
    registryCount: document.getElementById("registry-count"),
    swarmTitle: document.getElementById("swarm-title"),
    swarmMeta: document.getElementById("swarm-meta"),
    swarmEmpty: document.getElementById("swarm-empty"),
    peerTableWrap: document.getElementById("peer-table-wrap"),
    swarmPeersEmpty: document.getElementById("swarm-peers-empty"),
    peerTbody: document.getElementById("peer-tbody"),
    swName: document.getElementById("sw-name"),
    swSize: document.getElementById("sw-size"),
    swHash: document.getElementById("sw-hash"),
    swSeeders: document.getElementById("sw-seeders"),
    swLeechers: document.getElementById("sw-leechers"),
    swTotal: document.getElementById("sw-total"),
    selTorrent: document.getElementById("sel-torrent"),
    inpTname: document.getElementById("inp-tname"),
    inpTsize: document.getElementById("inp-tsize"),
    inpPname: document.getElementById("inp-pname"),
    selRole: document.getElementById("sel-role"),
    eventStream: document.getElementById("event-stream"),
    eventsEmpty: document.getElementById("events-empty"),
    eventCount: document.getElementById("event-count"),
    streamLive: document.getElementById("stream-live"),
    btnPauseEvents: document.getElementById("btn-pause-events"),
    btnClearEvents: document.getElementById("btn-clear-events"),
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmDesc: document.getElementById("confirm-desc"),
    confirmOk: document.getElementById("confirm-ok"),
    confirmCancel: document.getElementById("confirm-cancel"),
    toasts: document.getElementById("toasts"),
};

// ───── NAMES FOR SIMULATION ─────
const NAMES = [
    "Alice","Bob","Charlie","Dave","Eve","Frank","Grace","Heidi",
    "Ivan","Judy","Karl","Linda","Mike","Nancy","Oscar","Peggy",
    "Quinn","Rita","Steve","Tina","Uma","Victor","Wendy","Xander",
    "Yara","Zack","Amit","Priya","Leo","Mia"
];

let confirmPending = null;   // { info_hash, name } for the open confirmation
let torrentsCache = [];      // cached full torrent objects (with peers)
let refreshTimer = null;
let eventTimer = null;

// ───── API UTILITY ─────

async function api(path, method = "GET", body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(path, opts);
        const data = await res.json();
        if (!res.ok) {
            toast(data.error || `Error ${res.status}`, "error");
            setConnOnline(false);
            return null;
        }
        setConnOnline(true);
        return data;
    } catch (e) {
        toast("Network error: " + e.message, "error");
        setConnOnline(false);
        return null;
    }
}

function setConnOnline(online) {
    if (state.connOnline === online) return;
    state.connOnline = online;
    if (online) {
        els.connStatus.classList.remove("offline");
        els.connText.textContent = "Tracker Online";
    } else {
        els.connStatus.classList.add("offline");
        els.connText.textContent = "Tracker Offline";
    }
}

// ───── TOAST NOTIFICATIONS ─────

function toast(msg, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    els.toasts.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateX(30px)";
        setTimeout(() => el.remove(), 260);
    }, 3000);
}

// ───── FORMATTING HELPERS ─────

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

function fmtBytes(b) {
    if (b == null || b <= 0) return "0 B";
    const u = ["B","KB","MB","GB","TB"];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
}

function fmtTime(ts) {
    if (ts == null) return "—";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function truncHash(h) {
    if (!h || h.length <= 16) return h;
    return h.slice(0, 8) + "…" + h.slice(-8);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
    } catch (e) {
        toast("Failed to copy", "error");
    }
}

// ───── LOADING STATE HELPERS ─────

function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.classList.add("loading");
        btn.disabled = true;
    } else {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

function setButtonsDisabled(ids, disabled) {
    ids.forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = disabled;
    });
}

// ───── RENDER: STATS ─────

function renderStats(stats) {
    const map = {
        statTorrents: stats.total_torrents,
        statPeers: stats.total_peers,
        statSeeders: stats.total_seeders,
        statLeechers: stats.total_leechers,
    };
    Object.entries(map).forEach(([key, val]) => setStatVal(els[key], val));
    state.prevStats = stats;
}

function setStatVal(el, val) {
    if (!el) return;
    const old = parseInt(el.textContent, 10);
    el.textContent = val;
    if (!isNaN(old) && old !== val) {
        el.style.transform = "scale(1.15)";
        el.style.color = "var(--accent)";
        requestAnimationFrame(() => {
            el.style.transform = "scale(1)";
            el.style.color = "";
        });
    }
}

// ───── RENDER: TORRENT TABLE ─────

function renderTorrents(torrents) {
    const tb = els.torrentTbody;
    const empty = els.registryEmpty;
    const countEl = els.registryCount;
    const tableEl = document.getElementById("torrents-table");

    if (!torrents.length) {
        tb.innerHTML = "";
        tb.hidden = true;
        tableEl.hidden = true;
        countEl.textContent = "0";
        empty.hidden = false;
        els.selTorrent.innerHTML = "";
        return;
    }

    tableEl.hidden = false;
    empty.hidden = true;
    tb.hidden = false;
    countEl.textContent = torrents.length;

    tb.innerHTML = torrents.map(t => {
        const selected = t.info_hash === state.selectedTorrent ? "selected" : "";
        const safeName = esc(t.name);
        const safeHash = esc(t.info_hash);
        const shortHash = truncHash(t.info_hash);
        return `
        <tr class="clickable ${selected}" role="row" aria-selected="${selected === 'selected'}" data-hash="${safeHash}">
            <td class="col-name cell-name">${safeName}</td>
            <td class="col-size">${esc(t.file_size)}</td>
            <td class="col-hash cell-hash trunc" title="${safeHash}">${shortHash}</td>
            <td class="col-count center"><span class="cell-count green">${t.seeder_count}</span></td>
            <td class="col-count center"><span class="cell-count red">${t.leecher_count}</span></td>
            <td class="col-count center"><span class="cell-count blue">${t.total_peers}</span></td>
            <td class="col-actions center">
                <button class="act-btn copy" title="Copy info hash" aria-label="Copy info hash" onclick="event.stopPropagation(); copyHash('${safeHash}')">
                    <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="act-btn remove" title="Delete torrent" aria-label="Delete torrent" onclick="event.stopPropagation(); openConfirm('${safeHash}', '${safeName}')">✕</button>
            </td>
        </tr>`;
    }).join("");

    // Row click to select torrent
    tb.querySelectorAll("tr[data-hash]").forEach(tr => {
        tr.addEventListener("click", () => selectTorrent(tr.dataset.hash));
    });

    // Update the add-peer torrent dropdown
    const sel = els.selTorrent;
    const cur = sel.value;
    sel.innerHTML = torrents.map(t => `<option value="${esc(t.info_hash)}">${esc(t.name)}</option>`).join("");
    if (cur && torrents.find(t => t.info_hash === cur)) sel.value = cur;
    else if (torrents.length && !state.selectedTorrent) sel.value = torrents[0].info_hash;
}

function copyHash(hash) {
    copyText(hash);
}

// ───── RENDER: SWARM DETAILS ─────

function renderSwarm(torrent) {
    if (!torrent) {
        els.swarmMeta.hidden = true;
        els.peerTableWrap.hidden = true;
        els.swarmPeersEmpty.hidden = true;
        els.swarmEmpty.hidden = false;
        els.swarmTitle.textContent = "Swarm Details";
        return;
    }

    els.swarmEmpty.hidden = true;
    els.swarmMeta.hidden = false;

    els.swarmTitle.textContent = `Swarm: ${esc(torrent.name)}`;
    els.swName.textContent = esc(torrent.name);
    els.swSize.textContent = esc(torrent.file_size);
    els.swHash.textContent = truncHash(torrent.info_hash);
    els.swHash.title = torrent.info_hash;
    els.swSeeders.textContent = torrent.seeder_count;
    els.swLeechers.textContent = torrent.leecher_count;
    els.swTotal.textContent = torrent.total_peers;

    if (!torrent.peers || !torrent.peers.length) {
        els.peerTableWrap.hidden = true;
        els.swarmPeersEmpty.hidden = false;
        return;
    }

    els.peerTableWrap.hidden = false;
    els.swarmPeersEmpty.hidden = true;

    const tb = els.peerTbody;
    tb.innerHTML = torrent.peers.map(p => {
        const isSeed = p.role === "seeder";
        const roleHtml = isSeed
            ? `<span class="role-badge seeder"><span class="role-dot"></span>Seeder</span>`
            : `<span class="role-badge leecher"><span class="role-dot"></span>Leecher</span>`;
        const progPct = Math.min(Math.max(p.progress, 0), 100);
        const progClass = isSeed ? "seeder" : "leecher";
        const safeName = esc(p.name);
        const safePid = esc(p.peer_id);
        const shortPid = truncHash(p.peer_id);
        return `
        <tr role="row">
            <td class="col-name cell-name">${safeName}</td>
            <td class="col-id cell-hash trunc" title="${safePid}">${shortPid}</td>
            <td class="col-role center">${roleHtml}</td>
            <td class="col-time center">${fmtTime(p.joined_at)}</td>
            <td class="col-time center">${fmtTime(p.last_seen)}</td>
            <td class="col-progress">
                <div class="progress-wrap">
                    <div class="progress-bar">
                        <div class="progress-fill ${progClass}" style="width:${progPct}%"></div>
                    </div>
                    <div class="progress-text">${progPct.toFixed(1)}%</div>
                </div>
            </td>
            <td class="col-actions center">
                <button class="act-btn leave" title="Remove peer" aria-label="Remove peer" onclick="event.stopPropagation(); leavePeer('${esc(torrent.info_hash)}','${safePid}')">Leave</button>
                ${!isSeed ? `<button class="act-btn promote" title="Promote to seeder" aria-label="Promote to seeder" onclick="event.stopPropagation(); promotePeer('${esc(torrent.info_hash)}','${safePid}')">Complete ↑</button>` : ""}
            </td>
        </tr>`;
    }).join("");
}

// ───── RENDER: EVENT STREAM ─────

function renderEvents(events) {
    if (!events || !events.length) return;

    const log = els.eventStream;
    if (els.eventsEmpty) els.eventsEmpty.hidden = true;

    const frag = document.createDocumentFragment();
    events.forEach(e => {
        const div = document.createElement("div");
        div.className = `event-row new ev-${e.type}`;
        const typeLabel = e.type
            .replace("TORRENT_", "")
            .replace("PEER_", "")
            .replace(/_/g, " ");
        const metaParts = [];
        if (e.peer) metaParts.push(`peer: ${esc(e.peer)}`);
        if (e.torrent) metaParts.push(`torrent: ${esc(e.torrent)}`);
        div.innerHTML = `
            <span class="event-time">${fmtTime(e.timestamp)}</span>
            <span class="event-type">${esc(typeLabel)}</span>
            <div class="event-body">
                <div class="event-msg">${esc(e.message)}</div>
                ${metaParts.length ? `<div class="event-meta">${metaParts.join(" · ")}</div>` : ""}
            </div>`;
        frag.appendChild(div);
    });
    log.prepend(frag);

    // Remove "new" highlight after animation
    setTimeout(() => {
        log.querySelectorAll(".event-row.new").forEach(el => el.classList.remove("new"));
    }, 2200);

    // Cap DOM entries
    while (log.children.length > 120) log.removeChild(log.lastChild);

    if (els.eventCount) els.eventCount.textContent = state.lastEventId;
}

// ───── DATA REFRESH ─────

async function refreshData() {
    if (state.refreshing) return;
    state.refreshing = true;

    const [torrents, stats] = await Promise.all([
        api("/api/torrents"),
        api("/api/stats"),
    ]);

    if (torrents) {
        torrentsCache = torrents;
        renderTorrents(torrents);

        // Auto-select first torrent on initial load if nothing selected
        if (!state.selectedTorrent && torrents.length) {
            selectTorrent(torrents[0].info_hash);
        } else if (state.selectedTorrent) {
            const t = torrents.find(x => x.info_hash === state.selectedTorrent);
            renderSwarm(t || null);
            if (!t) {
                // selected torrent was removed; pick another or clear
                if (torrents.length) selectTorrent(torrents[0].info_hash);
                else { state.selectedTorrent = null; renderSwarm(null); }
            }
        } else {
            renderSwarm(null);
        }
    }

    if (stats) renderStats(stats);

    state.refreshing = false;
}

async function pollEvents() {
    if (state.eventsPaused || state.refreshing) return;
    const events = await api(`/api/events?after_id=${state.lastEventId}`);
    if (events && events.length) {
        state.lastEventId = events[events.length - 1].event_id;
        renderEvents(events);
        await refreshData();
    }
}

function startPolling() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (eventTimer) clearInterval(eventTimer);
    eventTimer = setInterval(pollEvents, 2000);
    refreshTimer = setInterval(refreshData, 5000);
}

function stopPolling() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (eventTimer) clearInterval(eventTimer);
    refreshTimer = null;
    eventTimer = null;
}

// ───── USER ACTIONS ─────

function selectTorrent(ih) {
    state.selectedTorrent = ih;
    const sel = els.selTorrent;
    if (sel) sel.value = ih;
    // highlight selected row in the existing table
    els.torrentTbody.querySelectorAll("tr[data-hash]").forEach(tr => {
        const isNow = tr.dataset.hash === ih;
        tr.classList.toggle("selected", isNow);
        tr.setAttribute("aria-selected", isNow);
    });
    renderSwarm(torrentsCache.find(x => x.info_hash === ih) || null);
}

async function registerTorrent() {
    const name = els.inpTname.value.trim();
    const size = els.inpTsize.value.trim();
    if (!name || !size) return toast("Enter both file name and file size", "error");

    setButtonLoading(els.btnRegister, true);
    const r = await api("/api/torrents", "POST", { name, file_size: size });
    if (r) {
        els.inpTname.value = "";
        els.inpTsize.value = "";
        toast("Torrent registered");
        await refreshData();
    }
    setButtonLoading(els.btnRegister, false);
}

async function addPeer() {
    const ih = els.selTorrent.value;
    const name = els.inpPname.value.trim();
    const role = els.selRole.value;
    if (!ih || !name) return toast("Select a torrent and enter a peer name", "error");

    setButtonLoading(els.btnAddPeer, true);
    const r = await api(`/api/torrents/${ih}/announce`, "POST", { peer_name: name, role, event: "STARTED" });
    if (r) {
        els.inpPname.value = "";
        toast(`${name} joined as ${role}`);
        await refreshData();
    }
    setButtonLoading(els.btnAddPeer, false);
}

async function leavePeer(ih, pid) {
    await api(`/api/torrents/${ih}/leave`, "POST", { peer_id: pid });
    await refreshData();
}

async function promotePeer(ih, pid) {
    const r = await api(`/api/torrents/${ih}/promote`, "POST", { peer_id: pid });
    if (r) toast("Peer promoted to seeder");
    await refreshData();
}

function openConfirm(infoHash, name) {
    confirmPending = { infoHash, name };
    els.confirmTitle.textContent = `Delete "${esc(name)}"?`;
    els.confirmDesc.textContent = "This will remove the torrent and its entire swarm. This action cannot be undone.";
    els.confirmDialog.showModal();
}

async function removeTorrent(infoHash) {
    await api(`/api/torrents/${infoHash}`, "DELETE");
    if (state.selectedTorrent === infoHash) {
        state.selectedTorrent = null;
        renderSwarm(null);
    }
    await refreshData();
}

// ───── SIMULATION ─────

async function simRandomJoin() {
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[Math.floor(Math.random() * torrents.length)];
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const role = Math.random() > 0.6 ? "seeder" : "leecher";
    await api(`/api/torrents/${t.info_hash}/announce`, "POST", { peer_name: name, role, event: "STARTED" });
    await refreshData();
}

async function simRandomLeave() {
    const torrents = await api("/api/torrents");
    if (!torrents) return;
    const pool = torrents.filter(t => t.total_peers > 0);
    if (!pool.length) return toast("No peers to remove", "error");
    const t = pool[Math.floor(Math.random() * pool.length)];
    const p = t.peers[Math.floor(Math.random() * t.peers.length)];
    await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: p.peer_id });
    await refreshData();
}

async function simProgressTick() {
    const r = await api("/api/simulate/progress", "POST");
    if (r && r.promoted && r.promoted.length) toast(`${r.promoted.join(", ")} completed download!`);
    else if (r) toast("Progress advanced for all leechers");
    await refreshData();
}

async function simTimeout() {
    const r = await api("/api/simulate/timeout", "POST");
    if (r && r.expired && r.expired.length) toast(`${r.expired.length} peer(s) timed out`, "error");
    else toast("No peers timed out");
    await refreshData();
}

// ───── SCENARIOS ─────

async function scenFlashCrowd() {
    toast("Flash crowd: 6 leechers joining…");
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[0];
    for (let i = 0; i < 6; i++) {
        const name = "Peer-" + String.fromCharCode(65 + i + Math.floor(Math.random() * 10));
        await api(`/api/torrents/${t.info_hash}/announce`, "POST",
            { peer_name: name, role: "leecher", event: "STARTED" });
    }
    await refreshData();
    toast("Flash crowd joined!");
}

async function scenSeederDepart() {
    const torrents = await api("/api/torrents");
    if (!torrents) return;
    const t = torrents.find(x => x.seeder_count > 0) || torrents[0];
    if (!t) return toast("No torrents", "error");
    const seeders = t.peers.filter(p => p.role === "seeder");
    if (!seeders.length) return toast("No seeders to remove", "error");
    toast("All seeders departing…");
    for (const s of seeders) {
        await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: s.peer_id });
    }
    await refreshData();
    toast("All seeders left the swarm!");
}

async function scenLifecycle() {
    toast("Running full lifecycle…");
    const torrents = await api("/api/torrents");
    if (!torrents || !torrents.length) return toast("Register a torrent first", "error");
    const t = torrents[0];

    const r = await api(`/api/torrents/${t.info_hash}/announce`, "POST",
        { peer_name: "NewPeer", role: "leecher", event: "STARTED" });
    if (!r) return;
    const pid = r.peer_id;
    await refreshData();

    for (const pct of [30, 55, 80, 95]) {
        await delay(600);
        await api(`/api/torrents/${t.info_hash}/progress`, "POST", { peer_id: pid, progress: pct });
        await refreshData();
    }

    await delay(600);
    await api(`/api/torrents/${t.info_hash}/promote`, "POST", { peer_id: pid });
    await refreshData();

    await delay(800);
    await api(`/api/torrents/${t.info_hash}/leave`, "POST", { peer_id: pid });
    await refreshData();
    toast("Lifecycle complete!");
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

// ───── EVENT LISTENERS ─────

function wireListeners() {
    // Header
    els.btnRefresh.addEventListener("click", async () => {
        setButtonLoading(els.btnRefresh, true);
        await refreshData();
        await pollEvents();
        setButtonLoading(els.btnRefresh, false);
    });

    // Controls
    els.btnRegister.addEventListener("click", registerTorrent);
    els.btnAddPeer.addEventListener("click", addPeer);

    // Peer operations
    document.getElementById("btn-join").addEventListener("click", simRandomJoin);
    document.getElementById("btn-leave").addEventListener("click", simRandomLeave);
    document.getElementById("btn-progress").addEventListener("click", simProgressTick);
    document.getElementById("btn-timeout").addEventListener("click", simTimeout);

    // Scenarios
    document.getElementById("btn-flash").addEventListener("click", scenFlashCrowd);
    document.getElementById("btn-seeder-leave").addEventListener("click", scenSeederDepart);
    document.getElementById("btn-lifecycle").addEventListener("click", scenLifecycle);

    // Swarm hash copy
    els.btnCopyHash.addEventListener("click", () => {
        const hash = els.swHash.title;
        if (hash) copyText(hash);
    });

    // Event stream controls
    els.btnPauseEvents.addEventListener("click", () => {
        state.eventsPaused = !state.eventsPaused;
        els.btnPauseEvents.classList.toggle("btn-outline");
        els.btnPauseEvents.classList.toggle("btn-primary");
        els.streamLive.classList.toggle("hidden");
        const dot = els.streamLive.querySelector(".status-dot");
        if (state.eventsPaused) {
            els.btnPauseEvents.title = "Resume live updates";
            els.streamLive.querySelector("span:last-child").textContent = "Paused";
        } else {
            els.btnPauseEvents.title = "Pause live updates";
            els.streamLive.querySelector("span:last-child").textContent = "Live";
        }
    });

    els.btnClearEvents.addEventListener("click", () => {
        els.eventStream.innerHTML = "";
        els.eventsEmpty.hidden = false;
        if (els.eventCount) els.eventCount.textContent = "0";
        state.lastEventId = 0;
    });

    // Confirmation dialog
    els.confirmCancel.addEventListener("click", () => {
        confirmPending = null;
        els.confirmDialog.close();
    });

    els.confirmDialog.addEventListener("click", (e) => {
        if (e.target === els.confirmDialog) {
            confirmPending = null;
            els.confirmDialog.close();
        }
    });

    els.confirmOk.addEventListener("click", async () => {
        if (!confirmPending) return;
        els.confirmDialog.close();
        await removeTorrent(confirmPending.infoHash);
        confirmPending = null;
    });

    // Enter key in register inputs
    els.inpTname.addEventListener("keydown", (e) => { if (e.key === "Enter") registerTorrent(); });
    els.inpTsize.addEventListener("keydown", (e) => { if (e.key === "Enter") registerTorrent(); });
    els.inpPname.addEventListener("keydown", (e) => { if (e.key === "Enter") addPeer(); });
}

// ───── INIT ─────

(async () => {
    wireListeners();
    await refreshData();
    await pollEvents();
    startPolling();
})();
