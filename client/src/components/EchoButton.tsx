import React from 'react';
import { send } from '../network';

interface EchoButtonProps {
  isEcho: boolean;
  resonance: number;
}

const EchoButton: React.FC<EchoButtonProps> = ({ isEcho, resonance }) => {
  const handleClick = () => {
    send({ type: 'toggle_echo', payload: {} });
  };

  const minutes = Math.floor(resonance / 60);
  const seconds = resonance % 60;
  const resonanceText = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

  const title = isEcho 
    ? `Reclaim Control (${resonanceText} remaining)` 
    : `Activate Echo (${resonanceText} available)`;

  const className = `action-button ${isEcho ? 'selected' : ''}`;

  return (
    <button id="echo-button" className={className} title={title} onClick={handleClick}>
      <img src="assets/echo-icon.png" alt="Echo" />
    </button>
  );
};

export default EchoButton;
