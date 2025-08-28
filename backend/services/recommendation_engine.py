import random
import os
import json

def get_recommended_batch(session_id, current_index, batch_size=5):
    """
    Placeholder for recommendation engine.
    Currently returns random reels, but will be replaced with actual recommendation logic.
    """
    # Load all reels
    reels_file = './data/reels.json'
    if not os.path.exists(reels_file):
        return []
    
    with open(reels_file, 'r') as f:
        all_reels = json.load(f)
    
    # For now, return random reels
    if len(all_reels) <= batch_size:
        return all_reels
    else:
        return random.sample(all_reels, batch_size)