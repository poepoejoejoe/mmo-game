import React from 'react';
import { send } from '../network';

const TeleportButton: React.FC = () => {
  const handleClick = () => {
    send({ type: 'teleport', payload: {} });
  };

  return (
    <button 
      id="teleport-button" 
      className="action-button" 
      title="Teleport to Sanctuary Stone" 
      onClick={handleClick}
    >
      <img src="assets/sanctuary-stone-icon.png" alt="Teleport" />
    </button>
  );
};

export default TeleportButton;
