// This file is the single source of truth for all game object properties.

import { drawCrudeAxe, drawPlayer, drawRat, drawRockTile, drawSanctuaryStone, drawSlime, drawTree, drawItem, drawWizard } from './drawing';
import { EntityState } from './types';

export interface TileProperties {
    isCollidable: boolean;
    isGatherable: boolean;
    isDestructible: boolean;
    isBuildableOn: boolean;
    movementPenalty: boolean;
    gatherResource?: string;
    maxHealth: number;
    color: string; // Add color here for rendering
    asset?: string | string[];
    draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, time: number, tileData: any) => void;
}

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
    },
    'water': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: true,
        maxHealth: 0,
        color: '#4682B4',
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
    'wooden_wall': {
        isCollidable: true,
        isGatherable: false,
        isDestructible: true,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 10,
        color: '#A0522D',
        asset: 'assets/wooden-wall-icon.png',
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
    },
};

/**
 * Helper function to safely get tile properties, defaulting to 'void'.
 */
export function getTileProperties(type: string): TileProperties {
    return tileDefs[type] || tileDefs['void'];
}

export const itemDefinitions: { [key: string]: { text?: string, icon?: string, character: string, color: string, asset?: string, equippable?: { slot: string, damage?: number }, draw?: (ctx: CanvasRenderingContext2D, pixelSize: number, direction: string) => void } } = {
    'wood': { text: 'Wood', icon: '🌲', character: 'W', color: '#8B4513', asset: 'assets/wood-icon.png' },
    'stone': { text: 'Stone', icon: '🪨', character: 'S', color: '#808080', asset: 'assets/stone-icon.png' },
    'goop': { text: 'Goop', icon: '💧', character: 'G', color: '#90EE90', asset: 'assets/goop-icon.png' },
    'rat_meat': { text: 'Rat Meat', icon: '🍖', character: 'M', color: '#DC143C', asset: 'assets/rat-meat-icon.png' },
    'cooked_rat_meat': { text: 'Cooked Meat', icon: '🥩', character: 'M', color: '#A52A2A', asset: 'assets/cooked-meat-icon.png' },
    'treasure_map': { text: 'Treasure Map', icon: '🗺️', character: 'M', color: '#FFD700', asset: 'assets/treasure-map-icon.png' },
    'slice_of_pizza': { text: 'Slice of Pizza', icon: '🍕', character: 'P', color: '#FFD700', asset: 'assets/pizza-slice-icon.png' },
    'fire': { text: 'Fire', icon: '🔥', character: 'F', color: '#FF4500', asset: 'assets/fire-icon.png' },
    'wooden_wall': { text: 'Wooden Wall', icon: '🧱', character: '#', color: '#A0522D', asset: 'assets/wooden-wall-icon.png' },
    'crude_axe': {
        text: 'Crude Axe',
        icon: '🪓',
        character: 'A',
        color: '#b5a642',
        asset: 'assets/crude-axe-icon.png',
        draw: drawCrudeAxe,
        equippable: {
            slot: 'weapon-slot',
            damage: 2,
        },
    },
    'default': { text: 'Unknown Item', icon: '❓', character: '?', color: '#FFFFFF' },
};

export const edibleDefs: { [key: string]: { healAmount: number } } = {
    'cooked_rat_meat': { healAmount: 2 },
    'slice_of_pizza': { healAmount: 5 },
};


// --- NEW: Entity Definitions ---

export interface EntityProperties {
    color: string;
    isAttackable?: boolean;
    asset?: string;
    draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }, props: EntityProperties) => void;
}

// The master definition map for all entity types.
export const entityDefs: Record<string, EntityProperties> = {
    'player': {
        color: '#3498db', // Blue
        draw: drawPlayer,
    },
    'slime': {
        color: '#b3db45ff', // Green
        isAttackable: true,
        draw: drawSlime,
    },
    'slime_boss': {
        color: '#556B2F', // Darker Green
        isAttackable: true,
        draw: drawSlime,
    },
    'rat': {
        color: '#800080', // Purple
        isAttackable: true,
        draw: drawRat,
    },
    'wizard': {
        color: '#3498db',
        isAttackable: false,
        draw: drawWizard,
    },
    'item': {
        color: 'transparent', // We'll render items with text instead
        draw: drawItem,
    },
    'default': {
        color: '#e74c3c', // Red (for other players/unknown)
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
    if (type === 'npc' && entity.name && entityDefs[entity.name]) {
        return entityDefs[entity.name];
    }
    if (entityDefs[type]) {
        return entityDefs[type];
    }
    return entityDefs['default'];
}