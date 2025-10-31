import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions, gearSlots } from '../definitions';
import { send } from '../network';
import Tooltip from './Tooltip';

interface GearPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gear: Record<string, InventoryItem>;
}

const GearPanel: React.FC<GearPanelProps> = ({ isOpen, onClose, gear }) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const createIconElement = (itemDef: any): JSX.Element => {
    if (itemDef.asset) {
      return <img src={itemDef.asset} alt={itemDef.text || 'item icon'} />;
    }
    return <>{itemDef.icon || itemDef.character}</>;
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, slot: string, item: InventoryItem) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSlot(slot);
    setTooltipPosition({
      x: rect.left,
      y: rect.bottom + 5,
    });
  };

  const handleMouseLeave = () => {
    setHoveredSlot(null);
    setTooltipPosition(null);
  };

  const handleSlotClick = (slot: string) => {
    send({ type: 'unequip', payload: { gearSlot: slot } });
  };

  const renderTooltipContent = (item: InventoryItem) => {
    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];

    return (
      <>
        <div className="tooltip-title">{itemDef.text || item.id}</div>
        <hr />
        <p className="tooltip-action">Unequip {itemDef.text || item.id}</p>
        {itemDef.equippable?.damage && (
          <p className="tooltip-stat">+{itemDef.equippable.damage} Damage</p>
        )}
        {itemDef.equippable?.defense && (
          <p className="tooltip-stat">+{itemDef.equippable.defense} Defense</p>
        )}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div id="gear-view" className="info-panel">
      <div className="panel-header">
        <h2>Gear</h2>
        <span className="close-button" onClick={onClose}>&times;</span>
      </div>
      {gearSlots.map((slot) => {
        const item = gear[slot];

        return (
          <div
            key={slot}
            className={`inventory-slot ${item ? 'unequippable' : ''}`}
            data-slot={slot}
            onClick={() => item && handleSlotClick(slot)}
            onMouseEnter={item ? (e) => handleMouseEnter(e, slot, item) : undefined}
            onMouseLeave={item ? handleMouseLeave : undefined}
          >
            {item ? (
              <div className="item-icon">
                {createIconElement(itemDefinitions[item.id] || itemDefinitions['default'])}
              </div>
            ) : (
              <div className="item-name">
                {slot.replace('-slot', '')}
              </div>
            )}
          </div>
        );
      })}
      {hoveredSlot && gear[hoveredSlot] && (
        <Tooltip show={true} position={tooltipPosition}>
          {renderTooltipContent(gear[hoveredSlot])}
        </Tooltip>
      )}
    </div>
  );
};

export default GearPanel;

