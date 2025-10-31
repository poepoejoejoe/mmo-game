import React from 'react';

interface HealthBarProps {
  health: number;
  maxHealth: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ health, maxHealth }) => {
  const healthPercentage = maxHealth > 0 ? (health / maxHealth) * 100 : 0;

  // Simple color transition from green to red
  const green = [76, 175, 80];
  const red = [211, 47, 47];

  const r = red[0] + (green[0] - red[0]) * (healthPercentage / 100);
  const g = red[1] + (green[1] - red[1]) * (healthPercentage / 100);
  const b = red[2] + (green[2] - red[2]) * (healthPercentage / 100);

  const barStyle = {
    width: `${healthPercentage}%`,
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
  };

  return (
    <div className="hp-display">
      <img src="assets/heart-icon.png" alt="Health" className="hud-icon" />
      <div id="health-bar-container">
        <div id="health-bar" style={barStyle}></div>
        <span id="health-bar-text">{health} / {maxHealth}</span>
      </div>
    </div>
  );
};

export default HealthBar;
