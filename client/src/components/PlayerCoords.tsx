import React from 'react';

interface PlayerCoordsProps {
  x: number;
  y: number;
}

const PlayerCoords: React.FC<PlayerCoordsProps> = ({ x, y }) => {
  return (
    <div id="player-coords">
      ({x}, {y})
    </div>
  );
};

export default PlayerCoords;
