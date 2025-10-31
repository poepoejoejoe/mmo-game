import React from 'react';

interface ActionButtonProps {
  panelId: string;
  icon: string;
  altText: string;
  isSelected: boolean;
  onClick: (panelId: string) => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ panelId, icon, altText, isSelected, onClick }) => {
  const className = `action-button ${isSelected ? 'selected' : ''}`;
  
  return (
    <button 
      className={className} 
      onClick={() => onClick(panelId)}
      id={`${panelId}-button`}
    >
      <img src={icon} alt={altText} />
    </button>
  );
};

export default ActionButton;
