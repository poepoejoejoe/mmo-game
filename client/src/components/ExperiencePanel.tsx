import React from 'react';
import PanelHeader from './shared/PanelHeader';

interface ExperiencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  experience: Record<string, number>;
}

const skillIcons: Record<string, string> = {
  woodcutting: 'assets/woodcutting-icon.png',
  mining: 'assets/mining-icon.png',
  smithing: 'assets/smithing-icon.png',
  cooking: 'assets/cooking-icon.png',
  construction: 'assets/construction-icon.png',
  attack: 'assets/attack-icon.png',
  defense: 'assets/defense-icon.png',
};

const ExperiencePanel: React.FC<ExperiencePanelProps> = ({ isOpen, onClose, experience }) => {
  if (!isOpen) return null;

  if (!experience || Object.keys(experience).length === 0) {
    return (
      <div id="experience-view" className="info-panel">
        <PanelHeader title="Experience" onClose={onClose} />
        <p>No experience data available.</p>
      </div>
    );
  }

  return (
    <div id="experience-view" className="info-panel">
      <PanelHeader title="Experience" onClose={onClose} />
      {Object.entries(experience).map(([skill, xp]) => {
        const icon = skillIcons[skill] || '❓';
        const name = skill.charAt(0).toUpperCase() + skill.slice(1);
        const level = Math.floor(xp / 100); // Example: 100 xp per level
        const xpForNextLevel = (level + 1) * 100;
        const currentLevelXp = xp - level * 100;
        const xpProgress = (currentLevelXp / 100) * 100;

        return (
          <div key={skill} className="skill-display">
            <div className="skill-icon">
              <img src={icon} alt={`${name} icon`} />
            </div>
            <div className="skill-info">
              <div className="skill-name">
                {name} (Level {level})
              </div>
              <div className="skill-bar-container">
                <div className="skill-bar" style={{ width: `${xpProgress}%` }}></div>
              </div>
              <div className="skill-xp-text">
                {Math.floor(xp)} / {xpForNextLevel} XP
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExperiencePanel;

