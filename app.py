"""
Flask Web Application for Mini BitTorrent Tracker Simulator.

Provides a REST API and web dashboard for interacting with the tracker.
All validation and error handling follows HTTP best practices.
"""

from flask import Flask, render_template, jsonify, request
from tracker import Tracker

app = Flask(__name__)
tracker = Tracker()


# ==================== SEED DEMO DATA ====================

def seed_demo_data():
    """Pre-populate the tracker for demonstration purposes."""
    t1 = tracker.register_torrent("ubuntu-24.04-desktop-amd64.iso", "4.7 GB")
    t2 = tracker.register_torrent("lecture-notes-ds-2026.pdf", "12 MB")
    t3 = tracker.register_torrent("project-dataset.zip", "250 MB")

    tracker.announce(t1.info_hash, "Alice", "seeder")
    tracker.announce(t1.info_hash, "Bob", "seeder")
    tracker.announce(t1.info_hash, "Charlie", "leecher")
    tracker.announce(t1.info_hash, "Dave", "leecher")

    tracker.announce(t2.info_hash, "Eve", "seeder")
    tracker.announce(t2.info_hash, "Frank", "leecher")

    tracker.announce(t3.info_hash, "Grace", "seeder")

seed_demo_data()


# ==================== VALIDATION HELPER ====================

def require_json(*fields):
    """Validate that the request body is JSON and contains the given non-empty fields.
    Returns (data_dict, None) on success or (None, error_response) on failure."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "Request body must be valid JSON"}), 400)
    for f in fields:
        v = data.get(f)
        if v is None or (isinstance(v, str) and not v.strip()):
            return None, (jsonify({"error": f"Missing required field: {f}"}), 400)
    return data, None


# ==================== WEB ROUTES ====================

@app.route("/")
def index():
    return render_template("index.html")


# ==================== API — STATS ====================

@app.route("/api/stats")
def api_stats():
    """Global tracker statistics."""
    return jsonify(tracker.get_stats())


@app.route("/api/stats/history")
def api_stats_history():
    """Stats snapshots for charting."""
    return jsonify(tracker.get_stats_history())


# ==================== API — TORRENTS ====================

@app.route("/api/torrents", methods=["GET"])
def api_get_torrents():
    return jsonify(tracker.get_all_torrents())


@app.route("/api/torrents", methods=["POST"])
def api_register_torrent():
    data, err = require_json("name", "file_size")
    if err:
        return err
    t = tracker.register_torrent(data["name"].strip(), data["file_size"].strip())
    return jsonify(t.to_dict()), 201


@app.route("/api/torrents/<info_hash>", methods=["GET"])
def api_get_torrent(info_hash):
    r = tracker.get_torrent(info_hash)
    if r is None:
        return jsonify({"error": "Torrent not found"}), 404
    return jsonify(r)


@app.route("/api/torrents/<info_hash>", methods=["DELETE"])
def api_remove_torrent(info_hash):
    if tracker.remove_torrent(info_hash):
        return jsonify({"status": "removed"})
    return jsonify({"error": "Torrent not found"}), 404


# ==================== API — ANNOUNCE / PEERS ====================

@app.route("/api/torrents/<info_hash>/announce", methods=["POST"])
def api_announce(info_hash):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    peer_name = (data.get("peer_name") or "").strip()
    role = (data.get("role") or "leecher").strip().lower()
    event = (data.get("event") or "STARTED").strip().upper()
    peer_id = data.get("peer_id")

    if event == "STARTED" and not peer_name:
        return jsonify({"error": "peer_name is required for STARTED events"}), 400
    if role not in ("seeder", "leecher"):
        return jsonify({"error": "role must be 'seeder' or 'leecher'"}), 400
    if event not in ("STARTED", "ANNOUNCE", "COMPLETED", "STOPPED"):
        return jsonify({"error": "event must be STARTED, ANNOUNCE, COMPLETED, or STOPPED"}), 400

    result = tracker.announce(info_hash, peer_name, role, event, peer_id)
    if result is None:
        return jsonify({"error": "Torrent not found or invalid operation"}), 404
    return jsonify(result), 201 if event == "STARTED" else 200


@app.route("/api/torrents/<info_hash>/leave", methods=["POST"])
def api_leave(info_hash):
    data, err = require_json("peer_id")
    if err:
        return err
    if tracker.leave(info_hash, data["peer_id"].strip()):
        return jsonify({"status": "left"})
    return jsonify({"error": "Torrent or peer not found"}), 404


@app.route("/api/torrents/<info_hash>/promote", methods=["POST"])
def api_promote(info_hash):
    data, err = require_json("peer_id")
    if err:
        return err
    if tracker.promote_to_seeder(info_hash, data["peer_id"].strip()):
        return jsonify({"status": "promoted"})
    return jsonify({"error": "Cannot promote: not found or already a seeder"}), 400


@app.route("/api/torrents/<info_hash>/progress", methods=["POST"])
def api_progress(info_hash):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400
    peer_id = (data.get("peer_id") or "").strip()
    progress = data.get("progress")
    if not peer_id or progress is None:
        return jsonify({"error": "peer_id and progress are required"}), 400
    try:
        progress = float(progress)
    except (ValueError, TypeError):
        return jsonify({"error": "progress must be a number"}), 400
    if not 0 <= progress <= 100:
        return jsonify({"error": "progress must be between 0 and 100"}), 400
    if tracker.update_progress(info_hash, peer_id, progress):
        return jsonify({"status": "updated"})
    return jsonify({"error": "Peer not found or already a seeder"}), 400


# ==================== API — SIMULATION ====================

@app.route("/api/simulate/progress", methods=["POST"])
def api_sim_progress():
    """Advance all leechers' download progress by one tick."""
    promoted = tracker.simulate_progress_tick()
    return jsonify({"promoted": promoted})


@app.route("/api/simulate/timeout", methods=["POST"])
def api_sim_timeout():
    """Expire peers that haven't re-announced recently."""
    expired = tracker.check_timeouts()
    return jsonify({"expired": expired})


# ==================== API — EVENTS ====================

@app.route("/api/events")
def api_events():
    """Event log. Use ?after_id=N for reliable incremental polling."""
    try:
        after_id = int(request.args.get("after_id", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "after_id must be an integer"}), 400
    return jsonify(tracker.get_events(after_id))


# ==================== RUN ====================

if __name__ == "__main__":
    print("=" * 60)
    print("  Mini BitTorrent Tracker Simulator")
    print("  Open http://127.0.0.1:5000 in your browser")
    print("=" * 60)
    app.run(host="127.0.0.1", port=5000)
