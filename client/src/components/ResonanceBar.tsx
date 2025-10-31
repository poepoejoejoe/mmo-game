import React from 'react';

interface ResonanceBarProps {
  resonance: number;
  maxResonance: number;
}

const ResonanceBar: React.FC<ResonanceBarProps> = ({ resonance, maxResonance }) => {
  const resonancePercentage = (resonance / maxResonance) * 100;

  const minutes = Math.floor(resonance / 60);
  const seconds = resonance % 60;
  const resonanceText = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

  return (
    <div className="resonance-display">
      <img src="assets/resonance-icon.png" alt="Resonance" className="hud-icon" />
      <div id="resonance-bar-container">
        <div id="resonance-bar" style={{ width: `${resonancePercentage}%` }}></div>
        <span id="resonance-bar-text">{resonanceText}</span>
      </div>
    </div>
  );
};

export default ResonanceBar;
