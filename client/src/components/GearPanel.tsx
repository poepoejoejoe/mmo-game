import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions, gearSlots } from '../definitions';
import { send } from '../network';
import Tooltip from './Tooltip';
import InventorySlot from './shared/InventorySlot';
import PanelHeader from './shared/PanelHeader';
import { useTooltip } from '../hooks/useTooltip';

interface GearPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gear: Record<string, InventoryItem>;
}

const GearPanel: React.FC<GearPanelProps> = ({ isOpen, onClose, gear }) => {
  const { hoveredKey: hoveredSlot, tooltipPosition, handleMouseEnter, handleMouseLeave } = useTooltip<string>();

  const handleSlotClick = (slotKey: string, item: InventoryItem | undefined) => {
    if (item) {
      send({ type: 'unequip', payload: { gearSlot: slotKey } });
    }
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
      <PanelHeader title="Gear" onClose={onClose} />
      {gearSlots.map((slot) => {
        const item = gear[slot];
        const emptySlotContent = (
          <div className="item-name">
            {slot.replace('-slot', '')}
          </div>
        );

        return (
          <InventorySlot
            key={slot}
            slotKey={slot}
            item={item}
            emptySlotContent={emptySlotContent}
            showQuantity={false}
            additionalClasses={item ? ['unequippable'] : []}
            onClick={handleSlotClick}
            onMouseEnter={(e, slot, item) => item && handleMouseEnter(e, slot)}
            onMouseLeave={handleMouseLeave}
          />
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

