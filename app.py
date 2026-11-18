"""
Flask Web Application for Mini BitTorrent Tracker Simulator
============================================================
Provides a REST API and web UI for interacting with the tracker.
"""

from flask import Flask, render_template, jsonify, request
from tracker import Tracker

app = Flask(__name__)
tracker = Tracker()

# --- Seed some example data for demo purposes ---
def seed_demo_data():
    """Pre-populate tracker with sample torrents and peers."""
    t1 = tracker.register_torrent("ubuntu-24.04-desktop-amd64.iso", "4.7 GB")
    t2 = tracker.register_torrent("lecture-notes-ds-2026.pdf", "12 MB")
    t3 = tracker.register_torrent("project-dataset.zip", "250 MB")

    # Add some peers to ubuntu torrent
    tracker.announce(t1.info_hash, "Alice", "seeder")
    tracker.announce(t1.info_hash, "Bob", "seeder")
    tracker.announce(t1.info_hash, "Charlie", "leecher")

    # Add some peers to lecture notes
    tracker.announce(t2.info_hash, "Dave", "seeder")
    tracker.announce(t2.info_hash, "Eve", "leecher")

seed_demo_data()


# ==================== WEB ROUTES ====================

@app.route("/")
def index():
    return render_template("index.html")


# ==================== API ROUTES ====================

@app.route("/api/torrents", methods=["GET"])
def get_torrents():
    """Get all tracked torrents."""
    return jsonify(tracker.get_all_torrents())


@app.route("/api/torrents", methods=["POST"])
def register_torrent():
    """Register a new torrent."""
    data = request.json
    name = data.get("name", "").strip()
    file_size = data.get("file_size", "").strip()
    if not name or not file_size:
        return jsonify({"error": "name and file_size are required"}), 400
    torrent = tracker.register_torrent(name, file_size)
    return jsonify(torrent.to_dict()), 201


@app.route("/api/torrents/<info_hash>", methods=["GET"])
def get_torrent(info_hash):
    """Get torrent details (scrape)."""
    result = tracker.get_torrent(info_hash)
    if result is None:
        return jsonify({"error": "Torrent not found"}), 404
    return jsonify(result)


@app.route("/api/torrents/<info_hash>", methods=["DELETE"])
def remove_torrent(info_hash):
    """Remove a torrent from tracker."""
    if tracker.remove_torrent(info_hash):
        return jsonify({"status": "removed"})
    return jsonify({"error": "Torrent not found"}), 404


@app.route("/api/torrents/<info_hash>/announce", methods=["POST"])
def announce(info_hash):
    """Peer announces to join a torrent swarm."""
    data = request.json
    peer_name = data.get("peer_name", "").strip()
    role = data.get("role", "leecher")
    if not peer_name:
        return jsonify({"error": "peer_name is required"}), 400
    result = tracker.announce(info_hash, peer_name, role)
    if result is None:
        return jsonify({"error": "Torrent not found"}), 404
    return jsonify(result), 201


@app.route("/api/torrents/<info_hash>/leave", methods=["POST"])
def leave(info_hash):
    """Peer leaves the swarm."""
    data = request.json
    peer_id = data.get("peer_id", "").strip()
    if not peer_id:
        return jsonify({"error": "peer_id is required"}), 400
    if tracker.leave(info_hash, peer_id):
        return jsonify({"status": "left"})
    return jsonify({"error": "Torrent or peer not found"}), 404


@app.route("/api/torrents/<info_hash>/promote", methods=["POST"])
def promote(info_hash):
    """Promote a leecher to seeder."""
    data = request.json
    peer_id = data.get("peer_id", "").strip()
    if not peer_id:
        return jsonify({"error": "peer_id is required"}), 400
    if tracker.promote_to_seeder(info_hash, peer_id):
        return jsonify({"status": "promoted"})
    return jsonify({"error": "Cannot promote (not found or already seeder)"}), 400


@app.route("/api/events", methods=["GET"])
def get_events():
    """Get event log (supports polling with ?since=timestamp)."""
    since = float(request.args.get("since", 0))
    events = tracker.get_events(since)
    return jsonify(events)


# ==================== RUN ====================

if __name__ == "__main__":
    print("=" * 60)
    print("  Mini BitTorrent Tracker Simulator")
    print("  Open http://127.0.0.1:5000 in your browser")
    print("=" * 60)
    app.run(debug=True, host="127.0.0.1", port=5000)
