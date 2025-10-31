import React from 'react';
import { itemDefinitions } from '../../definitions';

interface ItemIconProps {
  itemId: string;
  className?: string;
  alt?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ itemId, className = 'item-icon', alt }) => {
  const itemDef = itemDefinitions[itemId] || itemDefinitions['default'];
  
  if (itemDef.asset) {
    return (
      <div className={className}>
        <img src={itemDef.asset} alt={alt || itemDef.text || 'item icon'} />
      </div>
    );
  }
  
  return (
    <div className={className}>
      {itemDef.icon || itemDef.character}
    </div>
  );
};

export default ItemIcon;

