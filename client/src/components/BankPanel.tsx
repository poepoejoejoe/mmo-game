import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions } from '../definitions';
import { sendWithdrawItem } from '../network';
import Tooltip from './Tooltip';
import * as state from '../state';

interface BankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bank: Record<string, InventoryItem>;
}

const BankPanel: React.FC<BankPanelProps> = ({ isOpen, onClose, bank }) => {
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

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => {
    e.preventDefault();
    if (item) {
      setContextMenu({ slot: slotKey, x: e.clientX, y: e.clientY });
    }
  };

  const handleWithdraw = (slotKey: string, quantity?: number) => {
    if (quantity) {
      sendWithdrawItem(slotKey, quantity);
    } else {
      // Withdraw 1 by default
      sendWithdrawItem(slotKey, 1);
    }
    setContextMenu(null);
  };

  const handleSlotClick = (slotKey: string) => {
    // Left click withdraws 1 item
    const item = bank[slotKey];
    if (item) {
      sendWithdrawItem(slotKey, 1);
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

  const renderTooltipContent = (item: InventoryItem) => {
    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
    return (
      <>
        <div className="tooltip-title">{itemDef.text || item.id}</div>
        <div className="tooltip-stat">Quantity: {item.quantity}</div>
      </>
    );
  };

  if (!isOpen) return null;

  const hoveredItem = hoveredSlot ? bank[hoveredSlot] : null;

  return (
    <>
      <div id="bank-view" className="info-panel centered-panel">
        <div className="panel-header">
          <h2>Bank</h2>
          <span className="close-button" onClick={onClose}>&times;</span>
        </div>
        <div className="inventory-grid">
          {Array.from({ length: 64 }, (_, i) => {
            const slotKey = `slot_${i}`;
            const item = bank[slotKey];

            return (
              <div
                key={slotKey}
                className="inventory-slot"
                data-slot={slotKey}
                onClick={() => handleSlotClick(slotKey)}
                onContextMenu={(e) => handleContextMenu(e, slotKey, item)}
                onMouseEnter={item ? (e) => handleMouseEnter(e, slotKey, item) : undefined}
                onMouseLeave={item ? handleMouseLeave : undefined}
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
      </div>

      {hoveredItem && hoveredSlot && tooltipPosition && (
        <Tooltip
          show={true}
          position={tooltipPosition}
          className="inventory-tooltip"
        >
          {renderTooltipContent(hoveredItem)}
        </Tooltip>
      )}

      {contextMenu && bank[contextMenu.slot] && (
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
            const item = bank[contextMenu.slot];
            if (item && item.quantity >= q) {
              return (
                <button
                  key={q}
                  onClick={() => handleWithdraw(contextMenu.slot, q)}
                >
                  Withdraw {q}
                </button>
              );
            }
            return null;
          })}
          {bank[contextMenu.slot] && (
            <>
              <button onClick={() => handleWithdraw(contextMenu.slot, bank[contextMenu.slot].quantity)}>
                Withdraw All
              </button>
              <button onClick={() => handleWithdraw(contextMenu.slot)}>
                Withdraw X
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default BankPanel;

