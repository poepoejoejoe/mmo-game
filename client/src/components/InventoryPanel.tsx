import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { itemDefinitions, edibleDefs } from '../definitions';
import { send, sendLearnRecipe, sendDepositItem, sendReorderItem } from '../network';
import Tooltip from './Tooltip';
import InventorySlot from './shared/InventorySlot';
import PanelHeader from './shared/PanelHeader';
import ContextMenu, { ContextMenuOption } from './shared/ContextMenu';
import QuantityModal from './shared/QuantityModal';
import { useTooltip } from '../hooks/useTooltip';

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, InventoryItem>;
  isBankOpen?: boolean;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ isOpen, onClose, inventory, isBankOpen = false }) => {
  const { hoveredKey: hoveredSlot, tooltipPosition, handleMouseEnter, handleMouseLeave, clearTooltip } = useTooltip<string>();
  const [contextMenu, setContextMenu] = useState<{ slot: string; x: number; y: number } | null>(null);
  const [quantityModal, setQuantityModal] = useState<{ slot: string } | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);

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
      clearTooltip();
      setContextMenu({ slot: slotKey, x: e.clientX, y: e.clientY });
    }
  };

  const handleDeposit = (slotKey: string, quantity?: number) => {
    if (quantity) {
      sendDepositItem(slotKey, quantity);
    } else {
      // "Deposit X" - show quantity modal
      setQuantityModal({ slot: slotKey });
    }
    setContextMenu(null);
  };

  const handleQuantitySubmit = (quantity: number) => {
    if (quantityModal) {
      sendDepositItem(quantityModal.slot, quantity);
      setQuantityModal(null);
    }
  };


  const handleSlotClick = (slotKey: string, item: InventoryItem | undefined) => {
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => {
    if (item) {
      clearTooltip(); // Hide tooltip when dragging starts
      setDragSource(slotKey);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, slotKey: string) => {
    if (dragSource) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slotKey: string) => {
    if (dragSource && dragSource !== slotKey) {
      e.preventDefault();
      sendReorderItem('inventory', dragSource, slotKey);
      setDragSource(null);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDragSource(null);
  };

  if (!isOpen) return null;

  // Ensure inventory is always an object (fallback to empty object)
  const safeInventory = inventory || {};

  return (
    <div id="inventory-view" className="info-panel">
      <PanelHeader title="Inventory" onClose={onClose} />
      <div className="inventory-grid">
          {Array.from({ length: 10 }, (_, i) => {
            const slotKey = `slot_${i}`;
            const item = safeInventory[slotKey];
            
            // Build class names - only show action classes when bank is NOT open
            const additionalClasses: string[] = [];
            if (item && !isBankOpen) {
              if (edibleDefs[item.id]) additionalClasses.push('edible');
              if (itemDefinitions[item.id]?.equippable) additionalClasses.push('equippable');
              if (itemDefinitions[item.id]?.kind === 'recipe') additionalClasses.push('learnable');
            }

            return (
              <InventorySlot
                key={slotKey}
                slotKey={slotKey}
                item={item}
                additionalClasses={additionalClasses}
                draggable={true}
                onClick={handleSlotClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={(e, slotKey, item) => item && handleMouseEnter(e, slotKey)}
                onMouseLeave={handleMouseLeave}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            );
          })}
      </div>
      {hoveredSlot && safeInventory[hoveredSlot] && (
        <Tooltip show={true} position={tooltipPosition}>
          {renderTooltipContent(safeInventory[hoveredSlot])}
        </Tooltip>
      )}

      {contextMenu && safeInventory[contextMenu.slot] && isBankOpen && (
        <ContextMenu
          isOpen={true}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          options={(() => {
            const item = safeInventory[contextMenu.slot];
            const options: ContextMenuOption[] = [];
            
            // Add quantity options (1, 5, 10)
            [1, 5, 10].forEach((q) => {
              if (item && item.quantity >= q) {
                options.push({
                  label: `Deposit ${q}`,
                  onClick: () => handleDeposit(contextMenu.slot, q),
                });
              }
            });
            
            // Add "Deposit All" and "Deposit X"
            if (item) {
              options.push({
                label: `Deposit All (${item.quantity})`,
                onClick: () => handleDeposit(contextMenu.slot, item.quantity),
              });
              options.push({
                label: 'Deposit X',
                onClick: () => handleDeposit(contextMenu.slot),
              });
            }
            
            return options;
          })()}
        />
      )}

      {quantityModal && safeInventory[quantityModal.slot] && (
        <QuantityModal
          isOpen={true}
          title="How many?"
          maxQuantity={safeInventory[quantityModal.slot].quantity}
          onSubmit={handleQuantitySubmit}
          onCancel={() => setQuantityModal(null)}
        />
      )}
    </div>
  );
};

export default InventoryPanel;

