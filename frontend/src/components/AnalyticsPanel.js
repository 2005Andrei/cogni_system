import React from 'react';
import './AnalyticsPanel.css';

function AnalyticsPanel({ analytics, reels }) {

  const totalLikes = analytics.reel_interactions.reduce((sum, interaction) => sum + (interaction.likes || 0), 0);
  const totalRewatches = analytics.reel_interactions.reduce((sum, interaction) => sum + (interaction.rewatches || 0), 0);
  const totalSkips = analytics.reel_interactions.reduce((sum, interaction) => sum + (interaction.was_skipped ? 1 : 0), 0);

  const likedReelIndices = analytics.reel_interactions
    .filter(interaction => interaction.likes > 0)
    .map(interaction => interaction.reel_index);
  const likedCategories = Array.from(
    new Set(
      likedReelIndices
        .map(index => reels[index]?.tags || [])
        .flat()
    )
  ).sort();

  return (
    <div className="analytics-panel">
      <h2>Viewing Analytics</h2>
      <div className="analytics-item">
        <strong>Total Reels Watched:</strong> {analytics.reels_watched}
      </div>
      <div className="analytics-item">
        <strong>Total Likes:</strong> {totalLikes}
      </div>
      <div className="analytics-item">
        <strong>Total Rewatches:</strong> {totalRewatches}
      </div>
      <div className="analytics-item">
        <strong>Total Skips:</strong> {totalSkips}
      </div>
      <div className="analytics-item">
        <strong>Total Replays:</strong> {analytics.total_replays}
      </div>
      <div className="analytics-item">
        <strong>Watch Percentages:</strong>
        <ul>
          {analytics.watch_completion_ratios.map((ratio, index) => (
            <li key={index}>
              Reel {index}: {(ratio * 100).toFixed(1)}%
            </li>
          ))}
        </ul>
      </div>
      <div className="analytics-item">
        <strong>Liked Categories:</strong>
        {likedCategories.length > 0 ? (
          <ul>
            {likedCategories.map(category => (
              <li key={category}>#{category}</li>
            ))}
          </ul>
        ) : (
          <span> No categories liked yet.</span>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPanel;