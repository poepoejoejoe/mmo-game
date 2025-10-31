import React, { useEffect, useRef, useState } from 'react';

interface TooltipProps {
  show: boolean;
  position: { x: number; y: number } | null;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ show, position, children }) => {
  if (!show || !position) return null;

  return (
    <div
      className="inventory-tooltip"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      {children}
    </div>
  );
};

export default Tooltip;

