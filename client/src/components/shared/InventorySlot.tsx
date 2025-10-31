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
}) => {
  const classNames = [className, ...additionalClasses].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      data-slot={slotKey}
      onClick={() => onClick?.(slotKey, item)}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, slotKey, item) : undefined}
      onMouseEnter={onMouseEnter && item ? (e) => onMouseEnter(e, slotKey, item) : undefined}
      onMouseLeave={onMouseLeave}
      draggable={draggable && !!item}
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

