from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from datetime import datetime
import logging
import os
from threading import Lock

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# File paths for JSON storage
REELS_FILE = './data/reels.json'
SESSIONS_FILE = './sessions/sessions.json'

# File lock for thread-safe operations
sessions_lock = Lock()
session_file_locks = {}  # Per-session locks for <session_id>.json

# Initialize JSON files and directories if they don't exist
def init_files():
    os.makedirs(os.path.dirname(REELS_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(SESSIONS_FILE), exist_ok=True)
    os.makedirs('./sessions/', exist_ok=True)
    
    if not os.path.exists(SESSIONS_FILE):
        app.logger.info(f"Creating {SESSIONS_FILE}")
        with open(SESSIONS_FILE, 'w') as f:
            json.dump([], f)

init_files()

# Load JSON file with error handling
def load_json_file(file_path):
    try:
        if not os.path.exists(file_path):
            app.logger.warning(f"{file_path} not found, returning default structure")
            return {'session_id': '', 'interactions': []} if 'sessions' in file_path else []
        with open(file_path, 'r') as f:
            data = json.load(f)
            # Validate structure for session files
            if 'sessions' in file_path and isinstance(data, dict):
                if 'session_id' not in data or 'interactions' not in data or not isinstance(data['interactions'], list):
                    app.logger.warning(f"Invalid structure in {file_path}, resetting to default")
                    return {'session_id': data.get('session_id', ''), 'interactions': []}
            app.logger.debug(f"Loaded data from {file_path}: {data}")
            return data
    except json.JSONDecodeError:
        app.logger.error(f"{file_path} is malformed, resetting to default")
        return {'session_id': '', 'interactions': []} if 'sessions' in file_path else []
    except Exception as e:
        app.logger.error(f"Error reading {file_path}: {str(e)}")
        return {'session_id': '', 'interactions': []} if 'sessions' in file_path else []

# Save JSON file with thread-safe locking and backup
def save_json_file(file_path, data, lock=None):
    try:
        # Create a backup of the existing file
        if os.path.exists(file_path):
            backup_path = file_path + '.bak'
            with open(file_path, 'r') as f, open(backup_path, 'w') as bf:
                bf.write(f.read())
        
        # Validate data structure before saving
        if 'sessions' in file_path and isinstance(data, dict):
            if 'session_id' not in data or 'interactions' not in data or not isinstance(data['interactions'], list):
                app.logger.error(f"Invalid data structure for {file_path}: {data}")
                raise ValueError("Invalid session data structure")
        
        if lock:
            with lock:
                with open(file_path, 'w') as f:
                    json.dump(data, f, indent=2)
                app.logger.debug(f"Saved data to {file_path}: {data}")
        else:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            app.logger.debug(f"Saved data to {file_path}: {data}")
    except Exception as e:
        app.logger.error(f"Error writing to {file_path}: {str(e)}")
        # Restore from backup if write fails
        if os.path.exists(file_path + '.bak'):
            os.rename(file_path + '.bak', file_path)
            app.logger.info(f"Restored {file_path} from backup")
        raise

# Load reels from JSON file
def load_reels():
    return load_json_file(REELS_FILE)

# Load sessions from JSON file
def load_sessions():
    return load_json_file(SESSIONS_FILE)

# Load interactions for a specific session
def load_session_interactions(session_id):
    file_path = f"./sessions/{session_id}.json"
    data = load_json_file(file_path)
    # Ensure the loaded data has the expected structure
    if not isinstance(data, dict) or 'session_id' not in data or 'interactions' not in data:
        app.logger.warning(f"Invalid structure in {file_path}, initializing with session_id {session_id}")
        return {'session_id': session_id, 'interactions': []}
    return data

# Save interactions for a specific session
def save_session_interactions(session_id, data):
    file_path = f"./sessions/{session_id}.json"
    # Use per-session lock
    if session_id not in session_file_locks:
        session_file_locks[session_id] = Lock()
    try:
        with session_file_locks[session_id]:
            save_json_file(file_path, data)
    except Exception as e:
        app.logger.error(f"Failed to save session interactions to {file_path}: {str(e)}")
        raise

@app.route('/api/reels', methods=['GET'])
def get_all_reels():
    reels = load_reels()
    app.logger.info(f"Returning {len(reels)} reels")
    return jsonify(reels)

@app.route('/api/reel/<int:index>', methods=['GET'])
def get_reel(index):
    interaction_data = request.args.get('interaction')
    if interaction_data:
        try:
            interaction = json.loads(interaction_data)
            app.logger.info(f"Received interaction data for reel {index}: {interaction}")
            
            # Save interaction to session-specific JSON file
            session_id = interaction.get('session_id')
            if not session_id:
                app.logger.error("No session_id provided in interaction data")
                return jsonify({"error": "session_id required"}), 400
            
            session_data = load_session_interactions(session_id)
            engagement = interaction.get('metrics', {}).get('engagement', {})
            
            # Create interaction entry (excluding session_id)
            interaction_entry = {
                'reel_index': interaction.get('reel_index'),
                'watch_time': interaction.get('watch_time', 0),
                'completed': interaction.get('completed', False),
                'likes': interaction.get('likes', 0),
                'rewatches': interaction.get('rewatches', 0),
                'local_rewatches': interaction.get('local_rewatches', 0),
                'pauses': interaction.get('pauses', 0),
                'percentage_watched': interaction.get('percentage_watched', 0),
                'scroll_speed': interaction.get('scroll_speed', 0),
                'was_skipped': interaction.get('was_skipped', False),
                'session_duration': interaction.get('session_duration', 0),
                'hesitation_rate': engagement.get('hesitation_rate', 0.0),
                'quick_scroll_rate': engagement.get('quick_scroll_rate', 0.0),
                'attention_retention': engagement.get('attention_retention', 0.0),
                'rewatch_rate': engagement.get('rewatch_rate', 0.0),
                'engagement_rate': interaction.get('metrics', {}).get('engagement_rate', 0.0)
            }
            
            # Validate reel_index
            if interaction_entry['reel_index'] is None:
                app.logger.error("No reel_index provided in interaction data")
                return jsonify({"error": "reel_index required"}), 400
            
            # Update interactions, preserving all existing ones
            session_data['interactions'] = [i for i in session_data['interactions'] 
                                          if i['reel_index'] != interaction_entry['reel_index']]
            session_data['interactions'].append(interaction_entry)
            session_data['session_id'] = session_id
            save_session_interactions(session_id, session_data)
            app.logger.info(f"Saved interaction for session {session_id}, reel {interaction_entry['reel_index']}")
            
        except json.JSONDecodeError:
            app.logger.warning("Invalid interaction data format")
            return jsonify({"error": "Invalid interaction data format"}), 400
        except Exception as e:
            app.logger.error(f"Error saving interaction for reel {index}: {str(e)}")
            return jsonify({"error": f"Failed to save interaction: {str(e)}"}), 500
    
    reels = load_reels()
    if index < 0 or index >= len(reels):
        app.logger.error(f"Reel index {index} out of range")
        return jsonify({"error": "Reel not found"}), 404
    
    app.logger.info(f"Returning reel {index}")
    return jsonify(reels[index])

@app.route('/api/reel_count', methods=['GET'])
def get_reel_count():
    reels = load_reels()
    app.logger.info(f"Returning reel count: {len(reels)}")
    return jsonify({"count": len(reels)})

@app.route('/api/interaction', methods=['POST'])
def save_interaction():
    try:
        data = request.json
        session_id = data.get('session_id')
        interaction = data.get('interaction')
        if not session_id or not interaction:
            app.logger.error("Missing session_id or interaction in request")
            return jsonify({"error": "session_id and interaction required"}), 400

        app.logger.info(f"Received POST interaction data for session {session_id}: {interaction}")
        engagement = interaction.get('metrics', {}).get('engagement', {})

        # Load existing interactions for the session
        session_data = load_session_interactions(session_id)
        
        # Create interaction entry (excluding session_id)
        interaction_entry = {
            'reel_index': interaction.get('reel_index'),
            'watch_time': interaction.get('watch_time', 0),
            'completed': interaction.get('completed', False),
            'likes': interaction.get('likes', 0),
            'rewatches': interaction.get('rewatches', 0),
            'local_rewatches': interaction.get('local_rewatches', 0),
            'pauses': interaction.get('pauses', 0),
            'percentage_watched': interaction.get('percentage_watched', 0),
            'scroll_speed': interaction.get('scroll_speed', 0),
            'was_skipped': interaction.get('was_skipped', False),
            'session_duration': interaction.get('session_duration', 0),
            'hesitation_rate': engagement.get('hesitation_rate', 0.0),
            'quick_scroll_rate': engagement.get('quick_scroll_rate', 0.0),
            'attention_retention': engagement.get('attention_retention', 0.0),
            'rewatch_rate': engagement.get('rewatch_rate', 0.0),
            'engagement_rate': interaction.get('metrics', {}).get('engagement_rate', 0.0)
        }

        # Validate reel_index
        if interaction_entry['reel_index'] is None:
            app.logger.error("No reel_index provided in interaction data")
            return jsonify({"error": "reel_index required"}), 400

        # Update interactions, preserving all existing ones
        session_data['interactions'] = [i for i in session_data['interactions'] 
                                      if i['reel_index'] != interaction_entry['reel_index']]
        session_data['interactions'].append(interaction_entry)
        session_data['session_id'] = session_id
        save_session_interactions(session_id, session_data)
        app.logger.info(f"Saved POST interaction for session {session_id}, reel {interaction_entry['reel_index']}")
        
        return jsonify({"status": "success"})
    except Exception as e:
        app.logger.error(f"Error saving POST interaction: {str(e)}")
        return jsonify({"error": f"Failed to save interaction: {str(e)}"}), 500

@app.route('/api/session', methods=['POST'])
def save_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        session_data = data.get('session')
        if not session_id or not session_data:
            app.logger.error("Missing session_id or session data in request")
            return jsonify({"error": "session_id and session data required"}), 400

        app.logger.info(f"Saving session: {session_id}")
        # Load existing sessions
        sessions = load_sessions()
        
        # Create session entry
        session_entry = {
            'session_id': session_id,
            'start_time': session_data['start_time'],
            'end_time': session_data['end_time'],
            'reels_watched': session_data['reels_watched'],
            'session_length': session_data['session_length'],
            'avg_scroll_speed': session_data['avg_scroll_speed'],
            'time_to_first_skip': session_data['time_to_first_skip'],
            'watch_completion_ratio': session_data['watch_completion_ratio'],
            'total_replays': session_data.get('total_replays', 0),
            'total_skips': session_data.get('total_skips', 0),
            'total_pauses': session_data.get('total_pauses', 0)
        }

        sessions = [s for s in sessions if s['session_id'] != session_id]
        sessions.append(session_entry)
        save_json_file(SESSIONS_FILE, sessions, sessions_lock)
        app.logger.info(f"Saved session {session_id} to {SESSIONS_FILE}")
        
        return jsonify({"status": "success"})
    except Exception as e:
        app.logger.error(f"Error saving session: {str(e)}")
        return jsonify({"error": f"Failed to save session: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)