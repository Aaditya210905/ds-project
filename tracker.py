"""
Mini BitTorrent Tracker Simulator (Without Networking)
======================================================
Simulates a central BitTorrent tracker maintaining torrent registries,
peer swarms, and announce lifecycle events — all without actual networking.

Concepts: P2P, trackers, swarm, seeders, leechers, announce protocol.
"""

import time
import secrets
import random
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


# ==================== CONSTANTS ====================

FILE_SIZE_UNITS = {"KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}

PEER_TIMEOUT_SECONDS = 120  # Peers not seen within this window are expired


# ==================== HELPERS ====================

def generate_info_hash() -> str:
    """Generate a 20-byte (40 hex char) simulated info_hash, matching BTP spec."""
    return secrets.token_hex(20)


def generate_peer_id() -> str:
    """Generate a 20-byte (40 hex char) simulated peer_id, matching BTP spec."""
    return secrets.token_hex(20)


def parse_file_size(size_str: str) -> int:
    """Parse human-readable file size to bytes.  e.g. '4.7 GB' → 5046586573."""
    s = size_str.strip().upper()
    for unit, mult in FILE_SIZE_UNITS.items():
        if s.endswith(unit):
            try:
                return int(float(s[: -len(unit)].strip()) * mult)
            except ValueError:
                return 0
    try:
        return int(s)
    except ValueError:
        return 0


# ==================== DATA MODELS ====================

class PeerRole(Enum):
    SEEDER = "seeder"
    LEECHER = "leecher"


@dataclass
class Peer:
    """
    Represents a peer in a BitTorrent swarm.

    Fields mirror the announce protocol parameters:
      peer_id, port, uploaded, downloaded, left, and event.
    """
    peer_id: str
    name: str
    role: PeerRole
    port: int = 6881
    uploaded: int = 0
    downloaded: int = 0
    left: int = 0
    total_size: int = 0
    progress: float = 0.0        # 0.0 – 100.0
    joined_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "peer_id": self.peer_id,
            "name": self.name,
            "role": self.role.value,
            "port": self.port,
            "uploaded": self.uploaded,
            "downloaded": self.downloaded,
            "left": self.left,
            "progress": round(self.progress, 1),
            "joined_at": self.joined_at,
            "last_seen": self.last_seen,
        }


@dataclass
class Torrent:
    """Registry entry for one tracked file."""
    info_hash: str
    name: str
    file_size: str
    file_size_bytes: int = 0
    created_at: float = field(default_factory=time.time)
    peers: Dict[str, Peer] = field(default_factory=dict)

    @property
    def seeders(self) -> List[Peer]:
        return [p for p in self.peers.values() if p.role == PeerRole.SEEDER]

    @property
    def leechers(self) -> List[Peer]:
        return [p for p in self.peers.values() if p.role == PeerRole.LEECHER]

    def to_dict(self) -> dict:
        return {
            "info_hash": self.info_hash,
            "name": self.name,
            "file_size": self.file_size,
            "file_size_bytes": self.file_size_bytes,
            "created_at": self.created_at,
            "seeder_count": len(self.seeders),
            "leecher_count": len(self.leechers),
            "total_peers": len(self.peers),
            "peers": [p.to_dict() for p in self.peers.values()],
        }


# ==================== TRACKER ====================

class Tracker:
    """
    Central BitTorrent Tracker.

    Maintains a registry of torrents and their peer swarms.
    Supports the full announce lifecycle:
        STARTED  →  periodic ANNOUNCE  →  COMPLETED  →  STOPPED
    Tracks upload/download statistics and simulates peer timeouts.

    All public methods are thread-safe.
    """

    def __init__(self):
        self.torrents: Dict[str, Torrent] = {}
        self.event_log: List[dict] = []
        self._event_id: int = 0
        self._stats_history: List[dict] = []
        self.lock = threading.Lock()

    # ---------- internal helpers ----------

    def _emit(self, etype: str, msg: str, torrent: str = "", peer: str = "") -> dict:
        self._event_id += 1
        ev = {
            "event_id": self._event_id,
            "timestamp": time.time(),
            "type": etype,
            "message": msg,
            "torrent": torrent,
            "peer": peer,
        }
        self.event_log.append(ev)
        if len(self.event_log) > 200:
            self.event_log = self.event_log[-200:]
        return ev

    def _snapshot_stats(self):
        s = self._calc_stats()
        s["timestamp"] = time.time()
        self._stats_history.append(s)
        if len(self._stats_history) > 300:
            self._stats_history = self._stats_history[-300:]

    def _calc_stats(self) -> dict:
        seeders = leechers = peers = 0
        for t in self.torrents.values():
            seeders += len(t.seeders)
            leechers += len(t.leechers)
            peers += len(t.peers)
        return {
            "total_torrents": len(self.torrents),
            "total_peers": peers,
            "total_seeders": seeders,
            "total_leechers": leechers,
        }

    # ---------- Torrent operations ----------

    def register_torrent(self, name: str, file_size: str) -> Torrent:
        """Register a new torrent file with the tracker."""
        with self.lock:
            ih = generate_info_hash()
            t = Torrent(info_hash=ih, name=name, file_size=file_size,
                        file_size_bytes=parse_file_size(file_size))
            self.torrents[ih] = t
            self._emit("TORRENT_REGISTERED",
                       f"Torrent '{name}' ({file_size}) registered", torrent=name)
            self._snapshot_stats()
            return t

    def remove_torrent(self, info_hash: str) -> bool:
        """Remove a torrent and its entire swarm from the tracker."""
        with self.lock:
            t = self.torrents.pop(info_hash, None)
            if t is None:
                return False
            self._emit("TORRENT_REMOVED", f"Torrent '{t.name}' removed", torrent=t.name)
            self._snapshot_stats()
            return True

    # ---------- Announce lifecycle ----------

    def announce(self, info_hash: str, peer_name: str = "",
                 role: str = "leecher", event: str = "STARTED",
                 peer_id: str | None = None) -> Optional[dict]:
        """
        Handle a peer announce request (the core tracker protocol).

        Events
        ------
        STARTED   – peer joins the swarm (new peer_id assigned).
        ANNOUNCE  – periodic heartbeat (updates last_seen).
        COMPLETED – leecher finished downloading → becomes seeder.
        STOPPED   – peer is leaving the swarm.
        """
        with self.lock:
            t = self.torrents.get(info_hash)
            if t is None:
                return None

            event = event.upper()

            # --- STARTED: new peer joins ---
            if event == "STARTED" or peer_id is None:
                pid = generate_peer_id()
                pr = PeerRole.SEEDER if role == "seeder" else PeerRole.LEECHER
                sz = t.file_size_bytes

                if pr is PeerRole.SEEDER:
                    progress, dl, left = 100.0, sz, 0
                else:
                    progress = round(random.uniform(0, 15), 1)
                    dl = int(sz * progress / 100)
                    left = sz - dl

                p = Peer(peer_id=pid, name=peer_name, role=pr,
                         port=random.randint(6881, 6999),
                         uploaded=0, downloaded=dl, left=left,
                         total_size=sz, progress=progress)
                t.peers[pid] = p

                self._emit("PEER_STARTED",
                           f"Peer '{peer_name}' joined '{t.name}' as {pr.value}",
                           torrent=t.name, peer=peer_name)
                self._snapshot_stats()
                return {"peer_id": pid, "swarm": t.to_dict()}

            # --- ANNOUNCE: heartbeat ---
            if event == "ANNOUNCE" and peer_id in t.peers:
                p = t.peers[peer_id]
                p.last_seen = time.time()
                self._emit("PEER_ANNOUNCE",
                           f"Peer '{p.name}' re-announced for '{t.name}'",
                           torrent=t.name, peer=p.name)
                return {"peer_id": peer_id, "swarm": t.to_dict()}

            # --- COMPLETED: leecher → seeder ---
            if event == "COMPLETED" and peer_id in t.peers:
                p = t.peers[peer_id]
                if p.role is PeerRole.SEEDER:
                    return None
                p.role = PeerRole.SEEDER
                p.progress = 100.0
                p.downloaded = p.total_size
                p.left = 0
                p.last_seen = time.time()
                self._emit("PEER_COMPLETED",
                           f"Peer '{p.name}' completed download of '{t.name}'",
                           torrent=t.name, peer=p.name)
                self._snapshot_stats()
                return {"peer_id": peer_id, "swarm": t.to_dict()}

            # --- STOPPED: peer leaves ---
            if event == "STOPPED" and peer_id in t.peers:
                p = t.peers.pop(peer_id)
                self._emit("PEER_STOPPED",
                           f"Peer '{p.name}' left '{t.name}'",
                           torrent=t.name, peer=p.name)
                self._snapshot_stats()
                return {"peer_id": peer_id, "status": "removed"}

            return None

    # ---------- Convenience wrappers ----------

    def leave(self, info_hash: str, peer_id: str) -> bool:
        """Remove a peer from a swarm (shortcut for STOPPED event)."""
        with self.lock:
            t = self.torrents.get(info_hash)
            if t is None or peer_id not in t.peers:
                return False
            p = t.peers.pop(peer_id)
            self._emit("PEER_STOPPED", f"Peer '{p.name}' left '{t.name}'",
                       torrent=t.name, peer=p.name)
            self._snapshot_stats()
            return True

    def promote_to_seeder(self, info_hash: str, peer_id: str) -> bool:
        """Promote leecher → seeder (shortcut for COMPLETED event)."""
        with self.lock:
            t = self.torrents.get(info_hash)
            if t is None or peer_id not in t.peers:
                return False
            p = t.peers[peer_id]
            if p.role is PeerRole.SEEDER:
                return False
            p.role = PeerRole.SEEDER
            p.progress = 100.0
            p.downloaded = p.total_size
            p.left = 0
            p.last_seen = time.time()
            self._emit("PEER_COMPLETED",
                       f"Peer '{p.name}' completed download of '{t.name}'",
                       torrent=t.name, peer=p.name)
            self._snapshot_stats()
            return True

    def update_progress(self, info_hash: str, peer_id: str, progress: float) -> bool:
        """Update a leecher's download progress (0–99.9)."""
        with self.lock:
            t = self.torrents.get(info_hash)
            if t is None or peer_id not in t.peers:
                return False
            p = t.peers[peer_id]
            if p.role is PeerRole.SEEDER:
                return False
            p.progress = min(progress, 99.9)
            p.downloaded = int(p.total_size * p.progress / 100)
            p.left = p.total_size - p.downloaded
            if p.downloaded > 0:
                p.uploaded = random.randint(0, p.downloaded // 2)
            p.last_seen = time.time()
            return True

    # ---------- Simulation helpers ----------

    def simulate_progress_tick(self) -> List[str]:
        """Advance every leecher's progress by a random increment.
        Returns names of peers that completed."""
        promoted = []
        with self.lock:
            for t in self.torrents.values():
                for p in list(t.peers.values()):
                    if p.role is not PeerRole.LEECHER:
                        continue
                    p.progress = min(p.progress + random.uniform(5, 25), 100.0)
                    p.downloaded = int(p.total_size * p.progress / 100)
                    p.left = p.total_size - p.downloaded
                    if p.downloaded > 0:
                        p.uploaded = random.randint(0, p.downloaded // 3)
                    p.last_seen = time.time()
                    if p.progress >= 100.0:
                        p.progress = 100.0
                        p.role = PeerRole.SEEDER
                        p.left = 0
                        p.downloaded = p.total_size
                        promoted.append(p.name)
                        self._emit("PEER_COMPLETED",
                                   f"Peer '{p.name}' completed download of '{t.name}'",
                                   torrent=t.name, peer=p.name)
            if promoted:
                self._snapshot_stats()
        return promoted

    def check_timeouts(self) -> List[dict]:
        """Expire peers that haven't announced within PEER_TIMEOUT_SECONDS."""
        expired = []
        with self.lock:
            now = time.time()
            for t in self.torrents.values():
                for pid in list(t.peers):
                    p = t.peers[pid]
                    if now - p.last_seen > PEER_TIMEOUT_SECONDS:
                        t.peers.pop(pid)
                        expired.append({"peer": p.name, "torrent": t.name})
                        self._emit("PEER_EXPIRED",
                                   f"Peer '{p.name}' timed out from '{t.name}'",
                                   torrent=t.name, peer=p.name)
            if expired:
                self._snapshot_stats()
        return expired

    # ---------- Query operations ----------

    def get_torrent(self, info_hash: str) -> Optional[dict]:
        with self.lock:
            t = self.torrents.get(info_hash)
            return t.to_dict() if t else None

    def get_all_torrents(self) -> List[dict]:
        with self.lock:
            return [t.to_dict() for t in self.torrents.values()]

    def get_events(self, after_id: int = 0) -> List[dict]:
        with self.lock:
            return [e for e in self.event_log if e["event_id"] > after_id]

    def get_stats(self) -> dict:
        with self.lock:
            return self._calc_stats()

    def get_stats_history(self) -> List[dict]:
        with self.lock:
            return list(self._stats_history)
