// This file is the single source of truth for all game object properties.

export interface TileProperties {
    isCollidable: boolean;
    isGatherable: boolean;
    isDestructible: boolean;
    isBuildableOn: boolean;
    movementPenalty: boolean;
    gatherResource?: string;
    maxHealth: number;
    color: string; // Add color here for rendering
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
        color: '#4a4a4a',
    },
    'water': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: true,
        maxHealth: 0,
        color: '#2980b9',
    },
    'tree': {
        isCollidable: true,
        isGatherable: true,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        gatherResource: 'wood',
        maxHealth: 2,
        color: '#27ae60',
    },
    'rock': {
        isCollidable: true,
        isGatherable: true,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        gatherResource: 'rock',
        maxHealth: 4,
        color: '#888',
    },
    'wooden_wall': {
        isCollidable: true,
        isGatherable: false,
        isDestructible: true,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 10,
        color: '#8a6d3b',
    },
};

/**
 * Helper function to safely get tile properties, defaulting to 'void'.
 */
export function getTileProperties(type: string): TileProperties {
    return tileDefs[type] || tileDefs['void'];
}

export const itemDefinitions: { [key: string]: { character: string, color: string } } = {
    'wood': { character: 'W', color: '#8B4513' },
    'stone': { character: 'S', color: '#808080' },
    'goop': { character: 'G', color: '#00FF00' },
    'rat_meat': { character: 'M', color: '#FF0000' },
    'treasure_map': { character: 'M', color: '#FFFF00' },
    'default': { character: '?', color: '#FFFFFF' },
};


// --- NEW: Entity Definitions ---

export interface EntityProperties {
    color: string;
    isAttackable?: boolean;
}

// The master definition map for all entity types.
export const entityDefs: Record<string, EntityProperties> = {
    'player': {
        color: '#3498db', // Blue
    },
    'slime': {
        color: '#b3db45ff', // Green
        isAttackable: true,
    },
    'rat': {
        color: '#800080', // Purple
        isAttackable: true,
    },
    'item': {
        color: 'transparent', // We'll render items with text instead
    },
    'default': {
        color: '#e74c3c', // Red (for other players/unknown)
    }
};

/**
 * Helper function to safely get entity properties.
 */
export function getEntityProperties(type: string, entityId: string, myPlayerId: string | null): EntityProperties {
    if (entityId === myPlayerId) {
        return entityDefs['player'];
    }
    return entityDefs[type] || entityDefs['default'];
}