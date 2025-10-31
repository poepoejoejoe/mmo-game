import React from 'react';
import ActionButton from './ActionButton';

interface ActionBarProps {
  openPanels: Set<string>;
  onTogglePanel: (panelId: string) => void;
}

const actionButtons = [
  { panelId: 'inventory', icon: 'assets/inventory-icon.png', alt: 'Inventory' },
  { panelId: 'crafting', icon: 'assets/crafting-icon.png', alt: 'Crafting' },
  { panelId: 'gear', icon: 'assets/gear-icon.png', alt: 'Gear' },
  { panelId: 'quest', icon: 'assets/quest-icon.png', alt: 'Quests' },
  { panelId: 'experience', icon: 'assets/experience-icon.png', alt: 'Experience' },
  { panelId: 'runes', icon: 'assets/runes-icon.png', alt: 'Runes' },
];

const ActionBar: React.FC<ActionBarProps> = ({ openPanels, onTogglePanel }) => {
  return (
    <div id="main-action-bar" className="action-bar">
      {actionButtons.map(({ panelId, icon, alt }) => (
        <ActionButton
          key={panelId}
          panelId={panelId}
          icon={icon}
          altText={alt}
          isSelected={openPanels.has(panelId)}
          onClick={onTogglePanel}
        />
      ))}
    </div>
  );
};

export default ActionBar;
