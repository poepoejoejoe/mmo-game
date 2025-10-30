// This file is the single source of truth for all game object properties.

import { 
    drawRockTile, 
    drawTree, 
    drawPlayer, 
    drawItem, 
    drawWizard,
    drawRat,
    drawSlime,
    drawSanctuaryStone,
    drawIronRockTile,
    drawCrudeAxe,
} from './drawing';
import { TileProperties, ItemProperties, EntityProperties, EntityState } from './types';

// The master definition map for all tile types.
export const tileDefs: Record<string, TileProperties> = {
    'void': {
        isCollidable: true,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 0,
        color: '#000',
        gatherResource: '',
        draw: undefined
    },
    'ground': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: true,
        movementPenalty: false,
        maxHealth: 0,
        color: '#6B8E23',
        asset: undefined,
        gatherResource: '',
        draw: undefined
    },
    'water': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: true,
        maxHealth: 0,
        color: '#4682B4',
        gatherResource: '',
        draw: undefined
    },
    'tree': {
        isCollidable: true,
        isGatherable: true,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        gatherResource: 'wood',
        maxHealth: 2,
        color: '#228B22',
        draw: drawTree,
    },
    'rock': {
        isCollidable: true,
        isGatherable: true,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        gatherResource: 'rock',
        maxHealth: 4,
        color: '#A9A9A9',
        draw: drawRockTile,
    },
    'iron_rock': {
        isCollidable: true,
        isGatherable: true,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        gatherResource: 'iron',
        maxHealth: 8,
        color: '#8a8a8a',
        draw: drawIronRockTile,
    },
    'wooden_wall': {
        isCollidable: true,
        isGatherable: false,
        isDestructible: true,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 10,
        color: '#A0522D',
        asset: 'assets/wooden-wall-icon.png',
        gatherResource: '',
        draw: undefined
    },
    'fire': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 0,
        color: '#FF4500',
        asset: 'assets/fire-icon.png',
        gatherResource: '',
        draw: undefined
    },
    'sanctuary_stone': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 0,
        color: '#808080',
        draw: drawSanctuaryStone,
        gatherResource: ''
    },
};

/**
 * Helper function to safely get tile properties, defaulting to 'void'.
 */
export function getTileProperties(type: string): TileProperties {
    return tileDefs[type] || tileDefs['void'];
}

export const itemDefinitions: { [key: string]: ItemProperties } = {
    'wood': { text: 'Wood', icon: '🌲', character: 'w', color: '#8b4513', asset: 'assets/wood-icon.png' },
    'stone': { text: 'Stone', icon: '🪨', character: 's', color: '#808080', asset: 'assets/stone-icon.png' },
    'goop': { text: 'Goop', icon: '💧', character: 'g', color: '#90ee90', asset: 'assets/goop-icon.png' },
    'rat_meat': { text: 'Rat Meat', icon: '🍖', character: 'm', color: '#dc143c', asset: 'assets/rat-meat-icon.png' },
    'cooked_rat_meat': { text: 'Cooked Meat', icon: '🥩', character: 'm', color: '#a52a2a', asset: 'assets/cooked-meat-icon.png' },
    'treasure_map': { text: 'Treasure Map', icon: '🗺️', character: 'm', color: '#ffd700', asset: 'assets/treasure-map-icon.png' },
    'slice_of_pizza': { text: 'Slice of Pizza', icon: '🍕', character: 'p', color: '#ffd700', asset: 'assets/pizza-slice-icon.png' },
    'fire': { text: 'Fire', icon: '🔥', character: 'f', color: '#ff4500', asset: 'assets/fire-icon.png' },
    'wooden_wall': { text: 'Wooden Wall', icon: '🧱', character: '#', color: '#a0522d', asset: 'assets/wooden-wall-icon.png' },
    'crude_axe': { text: 'Crude Axe', icon: '⛏️', character: 'a', color: '#a0a0a0', asset: 'assets/crude-axe-icon.png', equippable: { slot: 'weapon-slot', damage: 1 }, draw: drawCrudeAxe },
    'iron_ore': { text: 'Iron Ore', icon: '⚒️', character: 'o', color: '#8a8a8a', asset: 'assets/iron-ore-icon.png' },
    'iron_helmet': { text: 'Iron Helmet', icon: '🎩', character: '^', color: '#c0c0c0', asset: 'assets/iron-helmet-icon.png', equippable: { slot: 'head-slot', defense: 1 } },
    'recipe_iron_helmet': { text: 'Recipe: Iron Helmet', icon: '📜', character: '?', color: '#ffffff', asset: 'assets/recipe-iron-helmet-icon.png', kind: 'recipe' },
    'default': { text: 'Unknown Item', icon: '❓', character: '?', color: '#FFFFFF' },
};

export const gearSlots = ['head-slot', 'weapon-slot'];

export const recipeDefs: { [key: string]: { [key: string]: number } } = {
    'wooden_wall': { 'wood': 10 },
    'fire': { 'wood': 10 },
    'cooked_rat_meat': { 'rat_meat': 1 },
    'crude_axe': { 'wood': 10, 'stone': 10, 'goop': 5 },
    'iron_helmet': { 'iron_ore': 5 },
};


export const edibleDefs: { [key: string]: { healAmount: number } } = {
    'cooked_rat_meat': { healAmount: 2 },
    'slice_of_pizza': { healAmount: 5 },
};


// --- NEW: Entity Definitions ---

// The master definition map for all entity types.
export const entityDefs: Record<string, EntityProperties> = {
    'player': {
        draw: drawPlayer,
    },
    'slime': {
        isAttackable: true,
        draw: drawSlime,
    },
    'slime_boss': {
        isAttackable: true,
        draw: drawSlime,
    },
    'rat': {
        isAttackable: true,
        draw: drawRat,
    },
    'wizard': {
        isAttackable: false,
        draw: drawWizard,
    },
    'item': {
        draw: drawItem,
    },
    'default': {
    }
};

/**
 * Helper function to safely get entity properties.
 */
export function getEntityProperties(type: string, entity: EntityState, myPlayerId: string | null): EntityProperties {
    if (entity.id === myPlayerId) {
        return entityDefs['player'];
    }
    // For NPCs, we use their name (e.g., "slime", "rat") as the key.
    if (type === 'npc' && entity.name) {
        if (entity.name === 'slime_boss') {
            return {
                ...entityDefs['slime'],
                color: 'rgb(15, 104, 28)',
            }
        }
        if (entityDefs[entity.name]) {
            return entityDefs[entity.name];
        }
    }
    if (entityDefs[type]) {
        return entityDefs[type];
    }
    return entityDefs['default'];
}