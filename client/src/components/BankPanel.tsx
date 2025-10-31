import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions } from '../definitions';
import { sendWithdrawItem } from '../network';
import Tooltip from './Tooltip';
import InventorySlot from './shared/InventorySlot';
import PanelHeader from './shared/PanelHeader';
import ContextMenu, { ContextMenuOption } from './shared/ContextMenu';
import QuantityModal from './shared/QuantityModal';
import { useTooltip } from '../hooks/useTooltip';

interface BankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bank: Record<string, InventoryItem>;
}

const BankPanel: React.FC<BankPanelProps> = ({ isOpen, onClose, bank }) => {
  const { hoveredKey: hoveredSlot, tooltipPosition, handleMouseEnter, handleMouseLeave } = useTooltip<string>();
  const [contextMenu, setContextMenu] = useState<{ slot: string; x: number; y: number } | null>(null);
  const [quantityModal, setQuantityModal] = useState<{ slot: string } | null>(null);

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
      // "Withdraw X" - show quantity modal
      setQuantityModal({ slot: slotKey });
    }
    setContextMenu(null);
  };

  const handleQuantitySubmit = (quantity: number) => {
    if (quantityModal) {
      sendWithdrawItem(quantityModal.slot, quantity);
      setQuantityModal(null);
    }
  };

  const handleSlotClick = (slotKey: string, item: InventoryItem | undefined) => {
    // Left click withdraws 1 item
    if (item) {
      sendWithdrawItem(slotKey, 1);
    }
    setContextMenu(null);
  };


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
        <PanelHeader title="Bank" onClose={onClose} />
        <div className="inventory-grid">
          {Array.from({ length: 64 }, (_, i) => {
            const slotKey = `slot_${i}`;
            const item = bank[slotKey];

            return (
              <InventorySlot
                key={slotKey}
                slotKey={slotKey}
                item={item}
                onClick={handleSlotClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={(e, slotKey, item) => item && handleMouseEnter(e, slotKey)}
                onMouseLeave={handleMouseLeave}
              />
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
        <ContextMenu
          isOpen={true}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          options={(() => {
            const item = bank[contextMenu.slot];
            const options: ContextMenuOption[] = [];
            
            // Add quantity options (1, 5, 10)
            [1, 5, 10].forEach((q) => {
              if (item && item.quantity >= q) {
                options.push({
                  label: `Withdraw ${q}`,
                  onClick: () => handleWithdraw(contextMenu.slot, q),
                });
              }
            });
            
            // Add "Withdraw All" and "Withdraw X"
            if (item) {
              options.push({
                label: `Withdraw All (${item.quantity})`,
                onClick: () => handleWithdraw(contextMenu.slot, item.quantity),
              });
              options.push({
                label: 'Withdraw X',
                onClick: () => handleWithdraw(contextMenu.slot),
              });
            }
            
            return options;
          })()}
        />
      )}

      {quantityModal && bank[quantityModal.slot] && (
        <QuantityModal
          isOpen={true}
          title="How many?"
          maxQuantity={bank[quantityModal.slot].quantity}
          onSubmit={handleQuantitySubmit}
          onCancel={() => setQuantityModal(null)}
        />
      )}
    </>
  );
};

export default BankPanel;

