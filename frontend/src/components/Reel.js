import React, { useState, useEffect, useRef } from 'react';

function Reel({ reel, index, onVisible, setAnalytics, scrollToReel, onReelComplete }) {
  const [watchTime, setWatchTime] = useState(0);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [rewatches, setRewatches] = useState(0);
  const [localRewatches, setLocalRewatches] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauses, setPauses] = useState(0);
  const [hesitationStart, setHesitationStart] = useState(null);
  const intervalRef = useRef(null);
  const lastUpdateTime = useRef(Date.now());
  const hasTriggeredCompletion = useRef(false);
  const viewStartTime = useRef(Date.now());
  const localRewatchTimer = useRef(null);
  const lastLocalRewatchTime = useRef(0);
  const rewatchCountRef = useRef(0);

  // Reset state when reel changes
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(localRewatchTimer.current);
    };
  }, [index]);

  useEffect(() => {
    if (!onVisible) {
      // When reel becomes invisible, send final analytics and clear timers
      const hesitationTime = hesitationStart ? (Date.now() - hesitationStart) / 1000 : 0;
      const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
      const interaction = {
        reel_index: index,
        watch_time: watchTime,
        completed,
        likes,
        rewatches,
        local_rewatches: localRewatches,
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        metrics: {
          engagement: {
            hesitation_rate: hesitationTime / (totalViewTime || 1),
            quick_scroll_rate: totalViewTime < 1 ? 1 : 0,
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: (rewatches + localRewatches) / (totalViewTime || 1)
          },
          engagement_rate: (likes + rewatches + localRewatches + pauses) / (totalViewTime || 1)
        }
      };
      setAnalytics(interaction);
      clearInterval(intervalRef.current);
      clearInterval(localRewatchTimer.current);
      return;
    }

    console.log(`Reel ${index} is visible, starting watch timer`);
    lastUpdateTime.current = Date.now();
    viewStartTime.current = Date.now();
    hasTriggeredCompletion.current = false;
    rewatchCountRef.current = 0;

    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        setWatchTime(prev => {
          const newTime = prev + deltaTime;
          
          // Check if reel completed for the first time
          if (newTime >= reel.time && !completed && !hasTriggeredCompletion.current) {
            setCompleted(true);
            setRewatches(prevRewatches => prevRewatches + 1);
            hasTriggeredCompletion.current = true;
            onReelComplete?.();
          }

          // Start local rewatch timer when watchTime exceeds reel.time
          if (newTime >= reel.time && onVisible && !localRewatchTimer.current) {
            localRewatchTimer.current = setInterval(() => {
              const currentTime = Date.now();
              // Only increment if at least 1 second has passed since last local rewatch
              if (currentTime - lastLocalRewatchTime.current >= 1000) {
                setLocalRewatches(prev => {
                  const newLocalRewatches = prev + 1;
                  rewatchCountRef.current = newLocalRewatches;
                  console.log(`Local rewatch incremented for reel ${index}: ${newLocalRewatches}`);
                  lastLocalRewatchTime.current = currentTime;
                  return newLocalRewatches;
                });
              }
            }, 1000);
          }
          
          return newTime;
        });
      }, 100);
    }

    return () => {
      console.log(`Reel ${index} is no longer visible, stopping timers`);
      clearInterval(intervalRef.current);
      clearInterval(localRewatchTimer.current);
      localRewatchTimer.current = null;
    };
  }, [onVisible, reel.time, index, setAnalytics, isPaused, onReelComplete, completed]);

  // Send periodic updates while visible
  useEffect(() => {
    if (onVisible) {
      const hesitationTime = hesitationStart ? (Date.now() - hesitationStart) / 1000 : 0;
      const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
      const interaction = {
        reel_index: index,
        watch_time: watchTime,
        completed,
        likes,
        rewatches,
        local_rewatches: localRewatches,
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        metrics: {
          engagement: {
            hesitation_rate: hesitationTime / (totalViewTime || 1),
            quick_scroll_rate: totalViewTime < 1 ? 1 : 0,
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: (rewatches + localRewatches) / (totalViewTime || 1)
          },
          engagement_rate: (likes + rewatches + localRewatches + pauses) / (totalViewTime || 1)
        }
      };
      setAnalytics(interaction);
    }
  }, [watchTime, completed, likes, rewatches, localRewatches, pauses, index, setAnalytics, onVisible, reel.time, hesitationStart]);

  const handleLike = () => {
    if (!hasLiked) {
      const newLikes = 1;
      setLikes(newLikes);
      setHasLiked(true);
      
      // Immediately update analytics with like
      const hesitationTime = hesitationStart ? (Date.now() - hesitationStart) / 1000 : 0;
      const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
      const interaction = {
        reel_index: index,
        watch_time: watchTime,
        completed,
        likes: newLikes,
        rewatches,
        local_rewatches: localRewatches,
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        metrics: {
          engagement: {
            hesitation_rate: hesitationTime / (totalViewTime || 1),
            quick_scroll_rate: totalViewTime < 1 ? 1 : 0,
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: (rewatches + localRewatches) / (totalViewTime || 1)
          },
          engagement_rate: (newLikes + rewatches + localRewatches + pauses) / (totalViewTime || 1)
        }
      };
      setAnalytics(interaction);
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      // Starting a pause
      setPauses(prev => prev + 1);
      setHesitationStart(Date.now());
      clearInterval(localRewatchTimer.current);
      localRewatchTimer.current = null;
    } else {
      setHesitationStart(null);
      // Restart local rewatch timer if watchTime exceeds reel.time
      if (watchTime >= reel.time && onVisible && !localRewatchTimer.current) {
        localRewatchTimer.current = setInterval(() => {
          const currentTime = Date.now();
          if (currentTime - lastLocalRewatchTime.current >= 1000) {
            setLocalRewatches(prev => {
              const newLocalRewatches = prev + 1;
              rewatchCountRef.current = newLocalRewatches;
              console.log(`Local rewatch incremented for reel ${index}: ${newLocalRewatches}`);
              lastLocalRewatchTime.current = currentTime;
              return newLocalRewatches;
            });
          }
        }, 1000);
      }
    }
  };

  const handleRewatch = () => {
    const newRewatches = rewatches + 1;
    setRewatches(newRewatches);
    // Reset completion state but keep watch time for accurate tracking
    setCompleted(false);
    hasTriggeredCompletion.current = false;
    
    // Clear and restart local rewatch timer
    clearInterval(localRewatchTimer.current);
    localRewatchTimer.current = null;
    
    // Restart local rewatch timer if still visible
    if (onVisible && watchTime >= reel.time) {
      localRewatchTimer.current = setInterval(() => {
        const currentTime = Date.now();
        if (currentTime - lastLocalRewatchTime.current >= 1000) {
          setLocalRewatches(prev => {
            const newLocalRewatches = prev + 1;
            rewatchCountRef.current = newLocalRewatches;
            console.log(`Local rewatch incremented for reel ${index}: ${newLocalRewatches}`);
            lastLocalRewatchTime.current = currentTime;
            return newLocalRewatches;
          });
        }
      }, 1000);
    }

    // Immediately update analytics with rewatch
    const hesitationTime = hesitationStart ? (Date.now() - hesitationStart) / 1000 : 0;
    const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
    const interaction = {
      reel_index: index,
      watch_time: watchTime,
      completed: false,
      likes,
      rewatches: newRewatches,
      local_rewatches: localRewatches,
      pauses,
      percentage_watched: (watchTime / reel.time) * 100,
      metrics: {
        engagement: {
          hesitation_rate: hesitationTime / (totalViewTime || 1),
          quick_scroll_rate: totalViewTime < 1 ? 1 : 0,
          attention_retention: Math.min(watchTime / (reel.time || 1), 1),
          rewatch_rate: (newRewatches + localRewatches) / (totalViewTime || 1)
        },
        engagement_rate: (likes + newRewatches + localRewatches + pauses) / (totalViewTime || 1)
      }
    };
    setAnalytics(interaction);
  };

  // Progress bar restarts after 100%
  const progress = ((watchTime % reel.time) / reel.time) * 100;
  const totalPercentageWatched = (watchTime / reel.time) * 100;

  return (
    <div className="reel">
      <div className="reel-label">{reel.label}</div>
      <div className="reel-tags">
        {reel.tags.map(tag => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>
      <div className="reel-info">
        <span>By {reel.info.author}</span>
        <span>{reel.info.views.toLocaleString()} views</span>
        <span>{reel.info.shares.toLocaleString()} shares</span>
        <span>{reel.info.saves.toLocaleString()} saves</span>
        <span>{reel.info.comments_num.toLocaleString()} comments</span>
        <span>Duration: {reel.time}s</span>
        <span>Watched: {totalPercentageWatched.toFixed(1)}%</span>
        <span>Rewatches: {rewatches}</span>
        <span>Local Rewatches: {localRewatches}</span>
      </div>
      <div className="reel-actions">
        <button onClick={handleLike} disabled={hasLiked}>
          {hasLiked ? 'Liked ✓' : 'Like'} ({likes})
        </button>
        <button onClick={handlePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={handleRewatch}>
          Rewatch ({rewatches})
        </button>
      </div>
      <div className="progress-container">
        <div 
          className="duration-bar"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      {completed && (
        <div className="completion-overlay">
          Reel Completed! Moving to next...
        </div>
      )}
    </div>
  );
}

export default Reel;