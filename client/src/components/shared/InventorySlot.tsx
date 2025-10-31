import React from 'react';
import { InventoryItem } from '../../types';
import ItemIcon from './ItemIcon';

interface InventorySlotProps {
  slotKey: string;
  item: InventoryItem | undefined;
  emptySlotContent?: React.ReactNode;
  showQuantity?: boolean;
  className?: string;
  additionalClasses?: string[];
  draggable?: boolean;
  onClick?: (slotKey: string, item: InventoryItem | undefined) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => void;
  onMouseLeave?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, slotKey: string, item: InventoryItem | undefined) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, slotKey: string) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, slotKey: string) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const InventorySlot: React.FC<InventorySlotProps> = ({
  slotKey,
  item,
  emptySlotContent = <>&nbsp;</>,
  showQuantity = true,
  className = 'inventory-slot',
  additionalClasses = [],
  draggable = false,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) => {
  const classNames = [className, ...additionalClasses].filter(Boolean).join(' ');

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (draggable && item) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', slotKey);
      onDragStart?.(e, slotKey, item);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Allow drag over even on empty slots if draggable is enabled
    if (draggable) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver?.(e, slotKey);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    // Allow drop even on empty slots if draggable is enabled
    if (draggable) {
      e.preventDefault();
      onDrop?.(e, slotKey);
    }
  };

  return (
    <div
      className={classNames}
      data-slot={slotKey}
      onClick={() => onClick?.(slotKey, item)}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, slotKey, item) : undefined}
      onMouseEnter={onMouseEnter && item ? (e) => onMouseEnter(e, slotKey, item) : undefined}
      onMouseLeave={onMouseLeave}
      draggable={draggable && !!item}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      {item ? (
        <>
          <ItemIcon itemId={item.id} />
          {showQuantity && <div className="item-quantity">{item.quantity}</div>}
        </>
      ) : (
        emptySlotContent
      )}
    </div>
  );
};

export default InventorySlot;

