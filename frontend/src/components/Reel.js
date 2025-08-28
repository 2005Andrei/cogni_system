import React, { useState, useEffect, useRef } from 'react';

function Reel({ reel, index, onVisible, setAnalytics, scrollToReel, onReelComplete }) {
  const [watchTime, setWatchTime] = useState(0);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [rewatches, setRewatches] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauses, setPauses] = useState(0);
  const [hesitationStart, setHesitationStart] = useState(null);
  const [lastScrollTime, setLastScrollTime] = useState(Date.now());
  const [hesitationEvents, setHesitationEvents] = useState(0);
  
  const intervalRef = useRef(null);
  const lastUpdateTime = useRef(Date.now());
  const hasTriggeredCompletion = useRef(false);
  const viewStartTime = useRef(Date.now());
  const scrollEvents = useRef([]);
  const lastInteractionTime = useRef(Date.now());

  // Reset state when reel changes
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [index]);

  useEffect(() => {
    if (!onVisible) {
      // When reel becomes invisible, send final analytics and clear timers
      const hesitationTime = hesitationStart ? (Date.now() - hesitationStart) / 1000 : 0;
      const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
      
      // Calculate hesitation rate based on actual hesitation events
      const calculatedHesitationRate = totalViewTime > 0 ? hesitationEvents / totalViewTime : 0;
      
      const interaction = {
        reel_index: index,
        watch_time: watchTime,
        completed,
        likes,
        rewatches,
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        was_skipped: watchTime < reel.time * 0.1, // Consider skipped if watched less than 10%
        metrics: {
          engagement: {
            hesitation_rate: calculatedHesitationRate,
            quick_scroll_rate: calculateQuickScrollRate(),
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: rewatches / (totalViewTime || 1)
          },
          engagement_rate: (likes + rewatches + pauses) / (totalViewTime || 1)
        }
      };
      setAnalytics(interaction);
      clearInterval(intervalRef.current);
      return;
    }

    console.log(`Reel ${index} is visible, starting watch timer`);
    lastUpdateTime.current = Date.now();
    viewStartTime.current = Date.now();
    hasTriggeredCompletion.current = false;
    setHesitationEvents(0);
    scrollEvents.current = [];

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
          
          return newTime;
        });
      }, 100);
    }

    return () => {
      console.log(`Reel ${index} is no longer visible, stopping timers`);
      clearInterval(intervalRef.current);
    };
  }, [onVisible, reel.time, index, setAnalytics, isPaused, onReelComplete, completed, hesitationEvents]);

  // Calculate quick scroll rate based on scroll events
  const calculateQuickScrollRate = () => {
    if (scrollEvents.current.length < 2) return 0;
    
    const recentEvents = scrollEvents.current.slice(-10); // Last 10 events
    const quickScrolls = recentEvents.filter(event => event.speed > 2); // Speed > 2 is considered quick
    return quickScrolls.length / recentEvents.length;
  };

  // Track scroll events for hesitation detection
  const trackScrollEvent = () => {
    const now = Date.now();
    const timeSinceLastScroll = (now - lastScrollTime) / 1000;
    setLastScrollTime(now);
    
    // Record scroll event with speed
    scrollEvents.current.push({
      timestamp: now,
      speed: timeSinceLastScroll > 0 ? 1 / timeSinceLastScroll : 0
    });
    
    // Keep only last 50 events
    if (scrollEvents.current.length > 50) {
      scrollEvents.current.shift();
    }
    
    // Detect hesitation (long pause between scrolls)
    if (timeSinceLastScroll > 1.5) { // More than 1.5 seconds is hesitation
      setHesitationEvents(prev => prev + 1);
    }
  };

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
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        was_skipped: watchTime < reel.time * 0.1, // Consider skipped if watched less than 10%
        metrics: {
          engagement: {
            hesitation_rate: totalViewTime > 0 ? hesitationEvents / totalViewTime : 0,
            quick_scroll_rate: calculateQuickScrollRate(),
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: rewatches / (totalViewTime || 1)
          },
          engagement_rate: (likes + rewatches + pauses) / (totalViewTime || 1)
        }
      };
      setAnalytics(interaction);
    }
  }, [watchTime, completed, likes, rewatches, pauses, index, setAnalytics, onVisible, reel.time, hesitationStart, hesitationEvents]);

  const handleLike = () => {
    if (!hasLiked) {
      const newLikes = 1;
      setLikes(newLikes);
      setHasLiked(true);
      
      // Immediately update analytics with like
      const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
      const interaction = {
        reel_index: index,
        watch_time: watchTime,
        completed,
        likes: newLikes,
        rewatches,
        pauses,
        percentage_watched: (watchTime / reel.time) * 100,
        was_skipped: watchTime < reel.time * 0.1,
        metrics: {
          engagement: {
            hesitation_rate: totalViewTime > 0 ? hesitationEvents / totalViewTime : 0,
            quick_scroll_rate: calculateQuickScrollRate(),
            attention_retention: Math.min(watchTime / (reel.time || 1), 1),
            rewatch_rate: rewatches / (totalViewTime || 1)
          },
          engagement_rate: (newLikes + rewatches + pauses) / (totalViewTime || 1)
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
    } else {
      // Ending a pause - track hesitation if pause was longer than 1.5 seconds
      const pauseDuration = (Date.now() - hesitationStart) / 1000;
      if (pauseDuration > 1.5) {
        setHesitationEvents(prev => prev + 1);
      }
      setHesitationStart(null);
    }
  };

  const handleRewatch = () => {
    const newRewatches = rewatches + 1;
    setRewatches(newRewatches);
    // Reset completion state but keep watch time for accurate tracking
    setCompleted(false);
    hasTriggeredCompletion.current = false;
    
    // Immediately update analytics with rewatch
    const totalViewTime = (Date.now() - viewStartTime.current) / 1000;
    const interaction = {
      reel_index: index,
      watch_time: watchTime,
      completed: false,
      likes,
      rewatches: newRewatches,
      pauses,
      percentage_watched: (watchTime / reel.time) * 100,
      was_skipped: false,
      metrics: {
        engagement: {
          hesitation_rate: totalViewTime > 0 ? hesitationEvents / totalViewTime : 0,
          quick_scroll_rate: calculateQuickScrollRate(),
          attention_retention: Math.min(watchTime / (reel.time || 1), 1),
          rewatch_rate: newRewatches / (totalViewTime || 1)
        },
        engagement_rate: (likes + newRewatches + pauses) / (totalViewTime || 1)
      }
    };
    setAnalytics(interaction);
  };

  // Progress bar restarts after 100%
  const progress = ((watchTime % reel.time) / reel.time) * 100;
  const totalPercentageWatched = (watchTime / reel.time) * 100;

  return (
    <div className="reel" onWheel={trackScrollEvent}>
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
        <span>Hesitation Events: {hesitationEvents}</span>
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