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
    'fire': {
        isCollidable: false,
        isGatherable: false,
        isDestructible: false,
        isBuildableOn: false,
        movementPenalty: false,
        maxHealth: 0,
        color: '#FF4500',
    },
};

/**
 * Helper function to safely get tile properties, defaulting to 'void'.
 */
export function getTileProperties(type: string): TileProperties {
	switch (type) {
		case 'ground':
			return { color: '#6B8E23', isCollidable: false, isBuildableOn: true, isGatherable: false, isDestructible: false, movementPenalty: false, maxHealth: 0 };
		case 'water':
			return { color: '#4682B4', isCollidable: false, movementPenalty: true, isBuildableOn: false, isGatherable: false, isDestructible: false, maxHealth: 0 };
		case 'tree':
			return { color: '#228B22', isCollidable: true, isGatherable: true, maxHealth: 2, isDestructible: false, isBuildableOn: false, movementPenalty: false };
		case 'rock':
			return { color: '#A9A9A9', isCollidable: true, isGatherable: true, maxHealth: 4, isDestructible: false, isBuildableOn: false, movementPenalty: false };
		case 'wooden_wall':
			return { color: '#A0522D', isCollidable: true, isDestructible: true, maxHealth: 10, isGatherable: false, isBuildableOn: false, movementPenalty: false };
		case 'fire':
			return { color: '#FF4500', isCollidable: false, isGatherable: false, isDestructible: false, isBuildableOn: false, movementPenalty: false, maxHealth: 0 };
		default:
			return { color: '#708090', isCollidable: false, isBuildableOn: false, isGatherable: false, isDestructible: false, movementPenalty: false, maxHealth: 0 };
	}
}

export const itemDefinitions: { [key: string]: { icon?: string, character: string, color: string, equippable?: { slot: string, damage?: number } } } = {
    'wood': { icon: '🌲', character: 'W', color: '#8B4513' },
    'stone': { icon: '🪨', character: 'S', color: '#808080' },
    'goop': { icon: '💧', character: 'G', color: '#90EE90' },
    'rat_meat': { icon: '🍖', character: 'M', color: '#DC143C' },
    'cooked_rat_meat': { icon: '🥩', character: 'M', color: '#A52A2A' },
    'treasure_map': { icon: '🗺️', character: 'M', color: '#FFD700' },
    'fire': { icon: '🔥', character: 'F', color: '#FF4500' },
    'wooden_wall': { icon: '🧱', character: '#', color: '#A0522D' },
    'crude_axe': {
        icon: '🪓',
        character: 'A',
        color: '#b5a642',
        equippable: {
            slot: 'weapon-slot',
            damage: 2,
        },
    },
    'default': { icon: '❓', character: '?', color: '#FFFFFF' },
};

export const edibleDefs: { [key: string]: { healAmount: number } } = {
    'cooked_rat_meat': { healAmount: 2 },
    'slice_of_pizza': { healAmount: 5 },
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