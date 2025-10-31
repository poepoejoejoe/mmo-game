import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions, edibleDefs } from '../definitions';
import { send, sendLearnRecipe } from '../network';
import Tooltip from './Tooltip';

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, InventoryItem>;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ isOpen, onClose, inventory }) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const createIconElement = (itemDef: any): JSX.Element => {
    if (itemDef.asset) {
      return <img src={itemDef.asset} alt={itemDef.text || 'item icon'} />;
    }
    return <>{itemDef.icon || itemDef.character}</>;
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, slotKey: string, item: InventoryItem) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSlot(slotKey);
    setTooltipPosition({
      x: rect.left,
      y: rect.bottom + 5,
    });
  };

  const handleMouseLeave = () => {
    setHoveredSlot(null);
    setTooltipPosition(null);
  };

  const renderTooltipContent = (item: InventoryItem) => {
    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
    const edible = edibleDefs[item.id];
    const equippable = itemDef.equippable;
    const isRecipe = itemDef.kind === 'recipe';

    return (
      <>
        <div className="tooltip-title">{itemDef.text || item.id}</div>
        {(edible || equippable || isRecipe) && <hr />}
        {equippable && (
          <>
            <p className="tooltip-action">Equip {itemDef.text || item.id}</p>
            {equippable.damage && <p className="tooltip-stat">+{equippable.damage} Damage</p>}
            {equippable.defense && <p className="tooltip-stat">+{equippable.defense} Defense</p>}
          </>
        )}
        {edible && (
          <>
            <p className="tooltip-action">Eat {itemDef.text || item.id}</p>
            <p className="tooltip-stat">+{edible.healAmount} Health</p>
          </>
        )}
        {isRecipe && <p className="tooltip-action">Learn Recipe</p>}
      </>
    );
  };

  const handleSlotClick = (slotKey: string, item: any) => {
    if (!item) return;

    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
    const edible = edibleDefs[item.id];
    const equippable = itemDef.equippable;
    const isRecipe = itemDef.kind === 'recipe';

    if (edible) {
      send({ type: 'eat', payload: { item: item.id } });
    } else if (equippable) {
      send({ type: 'equip', payload: { inventorySlot: slotKey } });
    } else if (isRecipe) {
      sendLearnRecipe(slotKey);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="inventory-view" className="info-panel">
      <div className="panel-header">
        <h2>Inventory</h2>
        <span className="close-button" onClick={onClose}>&times;</span>
      </div>
      <div className="inventory-grid">
        {Array.from({ length: 10 }, (_, i) => {
          const slotKey = `slot_${i}`;
          const item = inventory[slotKey];

          return (
            <div
              key={slotKey}
              className={`inventory-slot ${item ? (edibleDefs[item.id] ? 'edible' : '') : ''} ${item && itemDefinitions[item.id]?.equippable ? 'equippable' : ''} ${item && itemDefinitions[item.id]?.kind === 'recipe' ? 'learnable' : ''}`}
              data-slot={slotKey}
              onClick={() => item && handleSlotClick(slotKey, item)}
              onMouseEnter={item ? (e) => handleMouseEnter(e, slotKey, item) : undefined}
              onMouseLeave={item ? handleMouseLeave : undefined}
              draggable={!!item}
            >
              {item ? (
                <>
                  <div className="item-icon">
                    {createIconElement(itemDefinitions[item.id] || itemDefinitions['default'])}
                  </div>
                  <div className="item-quantity">{item.quantity}</div>
                </>
              ) : (
                <>&nbsp;</>
              )}
            </div>
          );
        })}
      </div>
      {hoveredSlot && inventory[hoveredSlot] && (
        <Tooltip show={true} position={tooltipPosition}>
          {renderTooltipContent(inventory[hoveredSlot])}
        </Tooltip>
      )}
    </div>
  );
};

export default InventoryPanel;

