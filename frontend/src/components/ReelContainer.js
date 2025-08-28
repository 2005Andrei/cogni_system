import React from 'react';
import Reel from './Reel';

function ReelContainer({ reel, index, isVisible, analytics, setAnalytics, sessionStart, scrollToReel, totalReelsWatched }) {
  const currentInteraction = analytics.reel_interactions.find(i => i.reel_index === index) || {
    likes: 0,
    rewatches: 0
  };

  console.log('Rendering ReelContainer with reel:', { reel, currentInteraction });

  return (
    <div className="reel-container">
      <Reel
        reel={reel}
        index={index}
        onVisible={isVisible}
        setAnalytics={setAnalytics}
        scrollToReel={scrollToReel}
      />
    </div>
  );
}

export default ReelContainer;