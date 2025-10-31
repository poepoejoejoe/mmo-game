import React from 'react';

interface PlayerNameDisplayProps {
  name: string;
}

const PlayerNameDisplay: React.FC<PlayerNameDisplayProps> = ({ name }) => {
  return (
    <div id="player-name-display">{name}</div>
  );
};

export default PlayerNameDisplay;
