import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const HelpTooltip: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const helpButton = document.getElementById('help-button');
    if (!helpButton) return;

    buttonRef.current = helpButton as HTMLButtonElement;

    const handleMouseEnter = () => {
      setIsHovered(true);
      // Calculate position below the button
      const rect = helpButton.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2, // Center horizontally
        y: rect.bottom + 10 // Below the button with 10px gap
      });
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    helpButton.addEventListener('mouseenter', handleMouseEnter);
    helpButton.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      helpButton.removeEventListener('mouseenter', handleMouseEnter);
      helpButton.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Adjust position to keep tooltip on screen
  useEffect(() => {
    if (!isHovered || !position || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Center horizontally, but adjust if it goes off screen
    if (rect.right > viewportWidth - padding) {
      adjustedX = viewportWidth - rect.width - padding;
    }
    if (rect.left < padding) {
      adjustedX = padding;
    }

    // Move above if it goes off bottom
    if (rect.bottom > viewportHeight - padding) {
      adjustedY = position.y - rect.height - 20; // Above button with gap
    }

    if (adjustedX !== position.x || adjustedY !== position.y) {
      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [isHovered, position]);

  if (!isHovered || !position) return null;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="help-tooltip"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)', // Center horizontally
        zIndex: 1000,
      }}
      onMouseEnter={() => setIsHovered(true)} // Keep tooltip visible when hovering over it
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="help-tooltip-content">
        <div className="help-tooltip-header">
          <h3>Controls</h3>
        </div>
        <div className="help-tooltip-body">
          <div className="help-tooltip-item">
            <b>Arrow Keys / WASD:</b> Move 1 tile
          </div>
          <div className="help-tooltip-item">
            <b>Right Click:</b> Click to move (if valid path exists)
          </div>
          <div className="help-tooltip-item">
            <b>Left-Click (and hold) Adjacent Resource:</b> Gather
          </div>
          <div className="help-tooltip-item">
            <b>B:</b> Build Wall mode (left click to place wall)
          </div>
          <div className="help-tooltip-item">
            <b>F:</b> Build Fire mode (left click to place fire)
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(tooltipContent, document.body);
};

export default HelpTooltip;


