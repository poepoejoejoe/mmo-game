import React, { useState } from 'react';
import { itemDefinitions, recipeDefs } from '../definitions';
import { send } from '../network';
import Tooltip from './Tooltip';
import ItemIcon from './shared/ItemIcon';
import PanelHeader from './shared/PanelHeader';
import { useTooltip } from '../hooks/useTooltip';

interface CraftingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, any>;
  knownRecipes: Record<string, boolean>;
}

const CraftingPanel: React.FC<CraftingPanelProps> = ({ isOpen, onClose, inventory, knownRecipes }) => {
  const { hoveredKey: hoveredRecipe, tooltipPosition, handleMouseEnter, handleMouseLeave } = useTooltip<string>();

  // Calculate item counts from inventory
  const counts: { [key: string]: number } = {};
  for (const slot in inventory) {
    if (inventory[slot]) {
      counts[inventory[slot].id] = (counts[inventory[slot].id] || 0) + inventory[slot].quantity;
    }
  }

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
                  <ItemIcon itemId={reqItemId} />
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
      <PanelHeader title="Crafting" onClose={onClose} />
      {recipeList.length === 0 ? (
        <p>You have not learned any crafting recipes.</p>
      ) : (
        recipeList.map((itemId) => {
          const recipeReqs = recipeDefs[itemId];
          const canCraft = Object.keys(recipeReqs).every(
            reqItemId => (counts[reqItemId] || 0) >= recipeReqs[reqItemId]
          );

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
              <ItemIcon itemId={itemId} />
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

