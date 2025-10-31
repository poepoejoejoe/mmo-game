import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  show: boolean;
  position: { x: number; y: number } | null;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ show, position, children, className = 'inventory-tooltip' }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(position);

  useEffect(() => {
    if (!show || !position || !tooltipRef.current) {
      setAdjustedPosition(position);
      return;
    }

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10; // Padding from screen edges

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Check right edge overflow
    if (rect.right > viewportWidth - padding) {
      adjustedX = viewportWidth - rect.width - padding;
    }

    // Check left edge overflow
    if (rect.left < padding) {
      adjustedX = padding;
    }

    // Check bottom edge overflow
    if (rect.bottom > viewportHeight - padding) {
      // Move tooltip above the element instead of below
      adjustedY = position.y - rect.height - 10; // 10px gap
    }

    // Check top edge overflow (if we moved it above)
    if (adjustedY < padding) {
      adjustedY = padding;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [show, position]);

  if (!show || !position) return null;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={className}
      style={{
        position: 'fixed',
        left: adjustedPosition ? `${adjustedPosition.x}px` : `${position.x}px`,
        top: adjustedPosition ? `${adjustedPosition.y}px` : `${position.y}px`,
        zIndex: 1000,
        visibility: adjustedPosition ? 'visible' : 'hidden', // Hide until position is calculated
      }}
    >
      {children}
    </div>
  );

  // Render tooltip at document body level to avoid clipping issues
  return createPortal(tooltipContent, document.body);
};

export default Tooltip;

