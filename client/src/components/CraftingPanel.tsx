import React, { useState } from 'react';
import * as state from '../state';
import { itemDefinitions, recipeDefs } from '../definitions';
import { send } from '../network';
import Tooltip from './Tooltip';

interface CraftingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, any>;
  knownRecipes: Record<string, boolean>;
}

const CraftingPanel: React.FC<CraftingPanelProps> = ({ isOpen, onClose, inventory, knownRecipes }) => {
  const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const createIconElement = (itemDef: any): JSX.Element => {
    if (itemDef.asset) {
      return <img src={itemDef.asset} alt={itemDef.text || 'item icon'} />;
    }
    return <>{itemDef.icon || itemDef.character}</>;
  };

  // Calculate item counts from inventory
  const counts: { [key: string]: number } = {};
  for (const slot in inventory) {
    if (inventory[slot]) {
      counts[inventory[slot].id] = (counts[inventory[slot].id] || 0) + inventory[slot].quantity;
    }
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, itemId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredRecipe(itemId);
    setTooltipPosition({
      x: rect.left,
      y: rect.bottom + 5,
    });
  };

  const handleMouseLeave = () => {
    setHoveredRecipe(null);
    setTooltipPosition(null);
  };

  const handleCraft = (itemId: string) => {
    send({ type: 'craft', payload: { item: itemId } });
  };

  const renderTooltipContent = (itemId: string) => {
    const recipeReqs = recipeDefs[itemId];
    const craftedItemDef = itemDefinitions[itemId] || itemDefinitions['default'];
    const hasCosts = recipeReqs && Object.keys(recipeReqs).length > 0;

    return (
      <>
        <div className="tooltip-title">Craft: {craftedItemDef.text || itemId}</div>
        <hr />
        {hasCosts && (
          <>
            <h4>Costs:</h4>
            {Object.entries(recipeReqs).map(([reqItemId, requiredAmount]) => {
              const itemDef = itemDefinitions[reqItemId] || itemDefinitions['default'];
              const hasEnough = (counts[reqItemId] || 0) >= (requiredAmount as number);
              return (
                <div key={reqItemId} className="tooltip-item">
                  <div className="item-icon">
                    {createIconElement(itemDef)}
                  </div>
                  <span style={{ color: hasEnough ? '#fff' : '#ff4444' }}>
                    {requiredAmount}x {itemDef.text || reqItemId}
                  </span>
                </div>
              );
            })}
          </>
        )}
        {itemId === 'cooked_rat_meat' && (
          <>
            {hasCosts && <hr />}
            <p className="special-req">Requires adjacent fire</p>
          </>
        )}
      </>
    );
  };

  if (!isOpen) return null;

  const recipeList: string[] = [];
  for (const itemIdToCraft in recipeDefs) {
    if (knownRecipes[itemIdToCraft]) {
      recipeList.push(itemIdToCraft);
    }
  }

  return (
    <div id="crafting-view" className="info-panel">
      <div className="panel-header">
        <h2>Crafting</h2>
        <span className="close-button" onClick={onClose}>&times;</span>
      </div>
      {recipeList.length === 0 ? (
        <p>You have not learned any crafting recipes.</p>
      ) : (
        recipeList.map((itemId) => {
          const recipeReqs = recipeDefs[itemId];
          const canCraft = Object.keys(recipeReqs).every(
            reqItemId => (counts[reqItemId] || 0) >= recipeReqs[reqItemId]
          );
          const itemDef = itemDefinitions[itemId] || itemDefinitions['default'];

          return (
            <button
              key={itemId}
              id={`craft-${itemId}-btn`}
              className="crafting-recipe"
              disabled={!canCraft}
              onClick={() => handleCraft(itemId)}
              onMouseEnter={(e) => handleMouseEnter(e, itemId)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="item-icon">
                {createIconElement(itemDef)}
              </div>
            </button>
          );
        })
      )}
      {hoveredRecipe && (
        <Tooltip show={true} position={tooltipPosition} className="crafting-tooltip">
          {renderTooltipContent(hoveredRecipe)}
        </Tooltip>
      )}
    </div>
  );
};

export default CraftingPanel;

