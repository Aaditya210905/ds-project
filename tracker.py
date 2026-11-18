"""
Mini BitTorrent Tracker Simulator (Without Networking)
======================================================
A simplified BitTorrent tracker that manages torrent swarms.
Peers can join/leave as seeders or leechers, and the tracker
maintains the mapping of files to their peer swarms.
"""

import time
import uuid
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class PeerRole(Enum):
    SEEDER = "seeder"
    LEECHER = "leecher"


@dataclass
class Peer:
    peer_id: str
    name: str
    role: PeerRole
    joined_at: float = field(default_factory=time.time)

    def to_dict(self):
        return {
            "peer_id": self.peer_id,
            "name": self.name,
            "role": self.role.value,
            "joined_at": self.joined_at,
        }


@dataclass
class Torrent:
    info_hash: str
    name: str
    file_size: str
    created_at: float = field(default_factory=time.time)
    peers: Dict[str, Peer] = field(default_factory=dict)

    @property
    def seeders(self) -> List[Peer]:
        return [p for p in self.peers.values() if p.role == PeerRole.SEEDER]

    @property
    def leechers(self) -> List[Peer]:
        return [p for p in self.peers.values() if p.role == PeerRole.LEECHER]

    def to_dict(self):
        return {
            "info_hash": self.info_hash,
            "name": self.name,
            "file_size": self.file_size,
            "created_at": self.created_at,
            "seeder_count": len(self.seeders),
            "leecher_count": len(self.leechers),
            "total_peers": len(self.peers),
            "peers": [p.to_dict() for p in self.peers.values()],
        }


class Tracker:
    """
    Central BitTorrent Tracker.
    
    Maintains a registry of torrents and their associated peer swarms.
    Peers can announce (join), leave, or be promoted from leecher to seeder.
    An event log records all swarm activity for real-time display.
    """

    def __init__(self):
        self.torrents: Dict[str, Torrent] = {}
        self.event_log: List[dict] = []
        self.lock = threading.Lock()

    def _log_event(self, event_type: str, message: str, torrent_name: str = "",
                   peer_name: str = ""):
        event = {
            "timestamp": time.time(),
            "type": event_type,
            "message": message,
            "torrent": torrent_name,
            "peer": peer_name,
        }
        self.event_log.append(event)
        # Keep only last 100 events
        if len(self.event_log) > 100:
            self.event_log = self.event_log[-100:]

    def register_torrent(self, name: str, file_size: str) -> Torrent:
        """Register a new torrent file with the tracker."""
        with self.lock:
            info_hash = uuid.uuid4().hex[:16]
            torrent = Torrent(info_hash=info_hash, name=name, file_size=file_size)
            self.torrents[info_hash] = torrent
            self._log_event("TORRENT_REGISTERED",
                            f"Torrent '{name}' ({file_size}) registered with tracker",
                            torrent_name=name)
            return torrent

    def announce(self, info_hash: str, peer_name: str,
                 role: str = "leecher") -> Optional[dict]:
        """
        Peer announces itself to the tracker for a specific torrent.
        This is equivalent to a BitTorrent 'announce' request.
        Returns the list of peers in the swarm (so the new peer knows who to connect to).
        """
        with self.lock:
            if info_hash not in self.torrents:
                return None

            torrent = self.torrents[info_hash]
            peer_id = uuid.uuid4().hex[:12]
            peer_role = PeerRole.SEEDER if role == "seeder" else PeerRole.LEECHER
            peer = Peer(peer_id=peer_id, name=peer_name, role=peer_role)
            torrent.peers[peer_id] = peer

            self._log_event(
                "PEER_JOINED",
                f"Peer '{peer_name}' joined swarm for '{torrent.name}' as {peer_role.value}",
                torrent_name=torrent.name,
                peer_name=peer_name,
            )
            return {
                "peer_id": peer_id,
                "swarm": torrent.to_dict(),
            }

    def leave(self, info_hash: str, peer_id: str) -> bool:
        """Peer leaves the swarm (stopped event in BitTorrent)."""
        with self.lock:
            if info_hash not in self.torrents:
                return False

            torrent = self.torrents[info_hash]
            if peer_id not in torrent.peers:
                return False

            peer = torrent.peers.pop(peer_id)
            self._log_event(
                "PEER_LEFT",
                f"Peer '{peer.name}' left swarm for '{torrent.name}'",
                torrent_name=torrent.name,
                peer_name=peer.name,
            )
            return True

    def promote_to_seeder(self, info_hash: str, peer_id: str) -> bool:
        """
        Promote a leecher to seeder (completed event in BitTorrent).
        This happens when a peer finishes downloading the file.
        """
        with self.lock:
            if info_hash not in self.torrents:
                return False

            torrent = self.torrents[info_hash]
            if peer_id not in torrent.peers:
                return False

            peer = torrent.peers[peer_id]
            if peer.role == PeerRole.SEEDER:
                return False  # Already a seeder

            peer.role = PeerRole.SEEDER
            self._log_event(
                "PEER_PROMOTED",
                f"Peer '{peer.name}' completed download and became a seeder for '{torrent.name}'",
                torrent_name=torrent.name,
                peer_name=peer.name,
            )
            return True

    def get_torrent(self, info_hash: str) -> Optional[dict]:
        """Get torrent details including full peer list (scrape)."""
        with self.lock:
            if info_hash not in self.torrents:
                return None
            return self.torrents[info_hash].to_dict()

    def get_all_torrents(self) -> List[dict]:
        """Get summary of all tracked torrents."""
        with self.lock:
            return [t.to_dict() for t in self.torrents.values()]

    def get_events(self, since: float = 0) -> List[dict]:
        """Get event log entries since a given timestamp."""
        with self.lock:
            return [e for e in self.event_log if e["timestamp"] > since]

    def remove_torrent(self, info_hash: str) -> bool:
        """Remove a torrent from the tracker."""
        with self.lock:
            if info_hash not in self.torrents:
                return False
            torrent = self.torrents.pop(info_hash)
            self._log_event(
                "TORRENT_REMOVED",
                f"Torrent '{torrent.name}' removed from tracker",
                torrent_name=torrent.name,
            )
            return True
