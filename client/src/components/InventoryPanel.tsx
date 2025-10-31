import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions, edibleDefs } from '../definitions';
import { send, sendLearnRecipe, sendDepositItem } from '../network';
import Tooltip from './Tooltip';

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, InventoryItem>;
  isBankOpen?: boolean;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ isOpen, onClose, inventory, isBankOpen = false }) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ slot: string; x: number; y: number } | null>(null);

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
    
    // If bank is open, show deposit info instead of normal actions
    if (isBankOpen) {
      return (
        <>
          <div className="tooltip-title">{itemDef.text || item.id}</div>
          <div className="tooltip-stat">Quantity: {item.quantity}</div>
          <hr />
          <p className="tooltip-action">Click to Deposit 1</p>
          <p className="tooltip-action">Right-click for more options</p>
        </>
      );
    }
    
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

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => {
    e.preventDefault();
    if (item && isBankOpen) {
      // Hide tooltip immediately when showing context menu
      setHoveredSlot(null);
      setTooltipPosition(null);
      setContextMenu({ slot: slotKey, x: e.clientX, y: e.clientY });
    }
  };

  const handleDeposit = (slotKey: string, quantity?: number) => {
    if (quantity) {
      sendDepositItem(slotKey, quantity);
    } else {
      // "Deposit X" - prompt for quantity
      const input = window.prompt('How many?');
      if (input) {
        const qty = parseInt(input, 10);
        if (!isNaN(qty) && qty > 0) {
          sendDepositItem(slotKey, qty);
        }
      }
    }
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  const handleSlotClick = (slotKey: string, item: any) => {
    if (!item) return;

    // If bank is open, deposit instead of normal actions
    if (isBankOpen) {
      sendDepositItem(slotKey, 1);
      setContextMenu(null);
      return;
    }

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
            
            // Build class names - only show action classes when bank is NOT open
            const classNames = ['inventory-slot'];
            if (item && !isBankOpen) {
              if (edibleDefs[item.id]) classNames.push('edible');
              if (itemDefinitions[item.id]?.equippable) classNames.push('equippable');
              if (itemDefinitions[item.id]?.kind === 'recipe') classNames.push('learnable');
            }

            return (
              <div
                key={slotKey}
                className={classNames.join(' ')}
                data-slot={slotKey}
                onClick={() => item && handleSlotClick(slotKey, item)}
                onContextMenu={(e) => handleContextMenu(e, slotKey, item)}
                onMouseEnter={item ? (e) => handleMouseEnter(e, slotKey, item) : undefined}
                onMouseLeave={item ? handleMouseLeave : undefined}
                draggable={!!item && !isBankOpen}
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

      {contextMenu && inventory[contextMenu.slot] && isBankOpen && (
        <div
          id="bank-context-menu"
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            display: 'block',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[1, 5, 10].map((q) => {
            const item = inventory[contextMenu.slot];
            if (item && item.quantity >= q) {
              return (
                <button
                  key={q}
                  onClick={() => handleDeposit(contextMenu.slot, q)}
                >
                  Deposit {q}
                </button>
              );
            }
            return null;
          })}
          {inventory[contextMenu.slot] && (
            <>
              <button onClick={() => handleDeposit(contextMenu.slot, inventory[contextMenu.slot].quantity)}>
                Deposit All
              </button>
              <button onClick={() => handleDeposit(contextMenu.slot)}>
                Deposit X
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryPanel;

