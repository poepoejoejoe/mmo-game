import { ClientState, WorldTile, EntityState } from './types';

// The global client state object. It is private to this module.
const clientState: ClientState = {
    playerId: null,
    entities: {},
    world: {},
    inventory: {}
};

// --- State Accessors (Getters) ---

export function getState(): ClientState {
    return clientState;
}

export function getMyEntity(): EntityState | undefined {
    if (!clientState.playerId) return undefined;
    return clientState.entities[clientState.playerId];
}

export function getTileData(x: number, y: number): WorldTile {
    const key = `${x},${y}`;
    return clientState.world[key] || { type: 'void', health: 0 };
}

// --- State Mutators (Setters) ---

export function setInitialState(
    playerId: string, 
    entities: Record<string, EntityState>, // This map now includes 'type'
    world: Record<string, WorldTile>, 
    inventory: Record<string, string>
) {
    clientState.playerId = playerId;
    clientState.entities = entities; // Directly assign the map
    clientState.world = world;
    for (const resource in inventory) {
        clientState.inventory[resource] = parseInt(inventory[resource], 10);
    }
}

export function setEntityPosition(entityId: string, x: number, y: number) {
    if (clientState.entities[entityId]) {
        clientState.entities[entityId].x = x;
        clientState.entities[entityId].y = y;
    }
}

// --- UPDATED ---
export function addEntity(entityId: string, x: number, y: number, type: string) {
    clientState.entities[entityId] = { x, y, type }; // Add with type
}

export function removeEntity(entityId: string) {
    delete clientState.entities[entityId];
}

// (Other functions remain the same)
export function setWorldTile(x: number, y: number, type: string, health: number = 0) {
    const key = `${x},${y}`;
    if (clientState.world[key]) {
        clientState.world[key].type = type;
        clientState.world[key].health = health;
    } else {
        clientState.world[key] = { type, health };
    }
}

export function setResourceHealth(x: number, y: number, health: number) {
    const key = `${x},${y}`;
    if (clientState.world[key]) {
        clientState.world[key].health = health;
    }
}

export function setInventoryItem(resource: string, amount: number) {
    clientState.inventory[resource] = amount;
}