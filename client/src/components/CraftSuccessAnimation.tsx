import React, { useState, useEffect, useRef } from 'react';
import { itemDefinitions } from '../definitions';

interface FloatingIcon {
  id: string;
  itemId: string;
  x: number;
  y: number;
}

const CraftSuccessAnimation: React.FC = () => {
  const [icons, setIcons] = useState<FloatingIcon[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Expose function for legacy code
    const showCraftSuccess = (itemId: string) => {
      const itemDef = itemDefinitions[itemId] || itemDefinitions.default;
      if (!itemDef || !itemDef.asset) return;

      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Try to find inventory view, crafting panel, or fall back to action bar
      let targetElement: HTMLElement | null = document.getElementById('inventory-view');
      
      // If inventory isn't open, try crafting panel
      if (!targetElement) {
        targetElement = document.getElementById('crafting-view');
      }
      
      // If crafting isn't open, try action bar
      if (!targetElement) {
        targetElement = document.getElementById('main-action-bar');
      }
      
      // If nothing found, use center of screen
      let x: number;
      let y: number;
      
      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        x = targetRect.left - containerRect.left + (targetRect.width / 2);
        y = targetRect.top - containerRect.top;
      } else {
        // Center of the container
        x = containerRect.width / 2;
        y = containerRect.height / 2;
      }

      const iconId = `icon-${Date.now()}-${Math.random()}`;
      const newIcon: FloatingIcon = {
        id: iconId,
        itemId,
        x,
        y,
      };

      setIcons(prev => [...prev, newIcon]);

      // Remove icon after animation completes (1.5s)
      setTimeout(() => {
        setIcons(prev => prev.filter(icon => icon.id !== iconId));
      }, 1500);
    };

    (window as any).showCraftSuccess = showCraftSuccess;

    return () => {
      delete (window as any).showCraftSuccess;
    };
  }, []);

  return (
    <div id="effect-container" ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      {icons.map(icon => {
        const itemDef = itemDefinitions[icon.itemId] || itemDefinitions.default;
        if (!itemDef || !itemDef.asset) return null;

        return (
          <img
            key={icon.id}
            src={itemDef.asset}
            className="floating-icon"
            style={{
              position: 'absolute',
              left: `${icon.x}px`,
              top: `${icon.y}px`,
            }}
            alt="Crafted item"
          />
        );
      })}
    </div>
  );
};

export default CraftSuccessAnimation;

