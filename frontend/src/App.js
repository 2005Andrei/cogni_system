import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReelContainer from './components/ReelContainer';
import AnalyticsPanel from './components/AnalyticsPanel';
import axios from 'axios';
import './App.css';

function App() {
  const [currentReel, setCurrentReel] = useState(null);
  const [reelBatch, setReelBatch] = useState([]);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [batchStartIndex, setBatchStartIndex] = useState(0);
  const [hasMoreReels, setHasMoreReels] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(Date.now().toString());
  const [sessionStart] = useState(new Date().toISOString());
  const [analytics, setAnalytics] = useState({
    reels_watched: 0,
    session_length: 0,
    scroll_speeds: [],
    time_to_first_skip: null,
    watch_completion_ratios: [],
    reel_interactions: [],
    total_replays: 0,
    total_skips: 0,
    total_pauses: 0
  });
  
  const lastInteraction = useRef(null);
  const analyticsRef = useRef(analytics);
  const sessionStartRef = useRef(sessionStart);
  const scrollTimestamps = useRef([]);
  const lastScrollTime = useRef(Date.now());

  useEffect(() => {
    analyticsRef.current = analytics;
  }, [analytics]);

  useEffect(() => {
    sessionStartRef.current = sessionStart;
  }, [sessionStart]);

  const calculateScrollSpeed = useCallback(() => {
    const now = Date.now();
    const timeDiff = (now - lastScrollTime.current) / 1000;
    lastScrollTime.current = now;
    
    if (timeDiff > 0) {
      const speed = 1 / timeDiff;
      scrollTimestamps.current.push({ timestamp: now, speed });
      
      if (scrollTimestamps.current.length > 10) {
        scrollTimestamps.current.shift();
      }
      
      return speed;
    }
    return 0;
  }, []);

  const fetchReelBatch = useCallback(async (startIndex = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/reels/batch', {
        params: {
          session_id: sessionId,
          current_index: startIndex,
          batch_size: 5
        }
      });
      
      const batchData = response.data;
      setReelBatch(batchData.reels);
      setBatchStartIndex(startIndex);
      setHasMoreReels(batchData.has_more);
      
      // Set the first reel from the batch as current
      if (batchData.reels.length > 0) {
        setCurrentReel(batchData.reels[0]);
        setCurrentReelIndex(startIndex);
      } else {
        setCurrentReel(null);
        setError('No reels available');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Batch fetch error:', err);
      setError('Failed to fetch reels. Check backend.');
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    console.log('App mounted, fetching initial batch');
    fetchReelBatch(0);
    
    return () => {
      console.log('saving session');
      const sessionEnd = new Date().toISOString();
      const session_length = (new Date(sessionEnd) - new Date(sessionStartRef.current)) / 1000;
      
      const currentAnalytics = analyticsRef.current;
      
      const avg_scroll_speed = scrollTimestamps.current.length > 0
        ? scrollTimestamps.current.reduce((sum, entry) => sum + entry.speed, 0) / scrollTimestamps.current.length
        : 0;

      axios.post('http://127.0.0.1:5000/api/session', {
        session_id: sessionId,
        session: {
          start_time: sessionStartRef.current,
          end_time: sessionEnd,
          reels_watched: currentAnalytics.reels_watched,
          session_length,
          avg_scroll_speed,
          time_to_first_skip: currentAnalytics.time_to_first_skip,
          watch_completion_ratio: currentAnalytics.watch_completion_ratios.length > 0 
            ? currentAnalytics.watch_completion_ratios.reduce((a, b) => a + b, 0) / currentAnalytics.watch_completion_ratios.length
            : 0,
          total_replays: currentAnalytics.total_replays,
          total_skips: currentAnalytics.total_skips,
          total_pauses: currentAnalytics.total_pauses
        }
      }).catch(err => console.error('Failed to save session:', err));
    };
  }, [sessionId, fetchReelBatch]);

  const saveCurrentInteraction = useCallback(() => {
    if (lastInteraction.current) {
      console.log('Saving interaction:', lastInteraction.current);
      axios.post('http://127.0.0.1:5000/api/interaction', {
        session_id: sessionId,
        interaction: {
          ...lastInteraction.current,
          scroll_speed: calculateScrollSpeed(),
          session_duration: (Date.now() - new Date(sessionStartRef.current)) / 1000
        }
      }).catch(err => console.error('Failed to save interaction:', err));
      lastInteraction.current = null;
    }
  }, [sessionId, calculateScrollSpeed]);

  const scrollToReel = useCallback((index) => {
    const scrollSpeed = calculateScrollSpeed();

    const currentInteraction = lastInteraction.current ? {
      ...lastInteraction.current,
      scroll_speed: scrollSpeed,
      was_skipped: index !== currentReelIndex + 1,
      session_duration: (Date.now() - new Date(sessionStartRef.current)) / 1000
    } : null;

    if (currentInteraction) {
      console.log('Saving interaction before navigation:', currentInteraction);
      axios.post('http://127.0.0.1:5000/api/interaction', {
        session_id: sessionId,
        interaction: currentInteraction
      }).catch(err => console.error('Failed to save interaction:', err));
      lastInteraction.current = null;
    }

    // Check if we need to fetch a new batch
    const batchRelativeIndex = index - batchStartIndex;
    
    if (batchRelativeIndex >= reelBatch.length && hasMoreReels) {
      // We've reached the end of the current batch, fetch next batch
      fetchReelBatch(batchStartIndex + reelBatch.length);
    } else if (batchRelativeIndex < 0 && batchStartIndex > 0) {
      // We're going backwards beyond the current batch
      // For simplicity, we'll just not allow going back beyond current batch
      console.log("Cannot navigate beyond current batch");
      return;
    } else if (batchRelativeIndex >= 0 && batchRelativeIndex < reelBatch.length) {
      // Navigate within current batch
      setCurrentReel(reelBatch[batchRelativeIndex]);
      setCurrentReelIndex(index);
      
      if (index > currentReelIndex + 1 && !analyticsRef.current.time_to_first_skip) {
        setAnalytics(prev => ({
          ...prev,
          time_to_first_skip: (Date.now() - new Date(sessionStartRef.current)) / 1000,
          total_skips: prev.total_skips + 1
        }));
      } else if (index !== currentReelIndex + 1) {
        setAnalytics(prev => ({
          ...prev,
          total_skips: prev.total_skips + 1
        }));
      }
    }
  }, [reelBatch, batchStartIndex, currentReelIndex, hasMoreReels, fetchReelBatch, sessionId, calculateScrollSpeed]);

  const handleInteractionUpdate = useCallback((interaction) => {
    console.log('Interaction update:', interaction);
    lastInteraction.current = interaction;
    
    setAnalytics(prev => {
      const currentReelDuration = currentReel?.time || 1;
      const completionRatio = interaction.watch_time / currentReelDuration;
      const isCompleted = completionRatio >= 0.95;
      
      const newWatchCompletionRatios = [...prev.watch_completion_ratios];
      if (interaction.reel_index < newWatchCompletionRatios.length) {
        newWatchCompletionRatios[interaction.reel_index] = completionRatio;
      } else {
        newWatchCompletionRatios.push(completionRatio);
      }

      // Find previous interaction for this reel to calculate delta
      const prevInteraction = prev.reel_interactions.find(i => i.reel_index === interaction.reel_index);
      
      const replayDelta = (interaction.rewatches + interaction.local_rewatches) - 
                         ((prevInteraction?.rewatches || 0) + (prevInteraction?.local_rewatches || 0));
      
      const pauseDelta = interaction.pauses - (prevInteraction?.pauses || 0);

      const newTotalReplays = prev.total_replays + Math.max(0, replayDelta);
      const newTotalPauses = prev.total_pauses + Math.max(0, pauseDelta);

      const newReelsWatched = isCompleted 
        ? Math.max(prev.reels_watched, interaction.reel_index + 1)
        : prev.reels_watched;

      return {
        ...prev,
        reels_watched: newReelsWatched,
        watch_completion_ratios: newWatchCompletionRatios,
        total_replays: newTotalReplays,
        total_pauses: newTotalPauses,
        reel_interactions: [
          ...prev.reel_interactions.filter(i => i.reel_index !== interaction.reel_index),
          interaction
        ]
      };
    });
  }, [currentReel]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' && (currentReelIndex < batchStartIndex + reelBatch.length - 1 || hasMoreReels)) {
        scrollToReel(currentReelIndex + 1);
      } else if (e.key === 'ArrowUp' && currentReelIndex > 0) {
        scrollToReel(currentReelIndex - 1);
      } else if (e.key === ' ') {
        console.log('Pause functionality triggered');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentReelIndex, batchStartIndex, reelBatch.length, hasMoreReels, scrollToReel]);

  console.log('App render state:', { 
    currentReel, 
    loading, 
    error, 
    reelBatch, 
    batchStartIndex, 
    currentReelIndex,
    hasMoreReels
  });

  return (
    <div className="App">
      <AnalyticsPanel analytics={analytics} reels={reelBatch} />
      {loading && <div className="error-message">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {!loading && !error && !currentReel && (
        <div className="error-message">No reels available.</div>
      )}
      {currentReel && !loading && !error && (
        <ReelContainer
          reel={currentReel}
          index={currentReelIndex}
          isVisible={true}
          analytics={analytics}
          setAnalytics={handleInteractionUpdate}
          sessionStart={sessionStart}
          scrollToReel={scrollToReel}
          totalReelsWatched={analytics.reels_watched}
          onReelComplete={() => {
            setTimeout(() => {
              if (currentReelIndex < batchStartIndex + reelBatch.length - 1 || hasMoreReels) {
                scrollToReel(currentReelIndex + 1);
              }
            }, 1000);
          }}
        />
      )}
      {currentReel && (currentReelIndex < batchStartIndex + reelBatch.length - 1 || hasMoreReels) && (
        <button
          className="next-reel-btn"
          onClick={() => scrollToReel(currentReelIndex + 1)}
        >
          ↓
        </button>
      )}
      {currentReel && currentReelIndex > 0 && (
        <button
          className="prev-reel-btn"
          style={{ top: '40%', right: '20px' }}
          onClick={() => scrollToReel(currentReelIndex - 1)}
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default App;