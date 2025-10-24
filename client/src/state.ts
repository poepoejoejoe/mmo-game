import { ClientState, WorldTile, EntityState, InventoryItem } from './types';

// The global client state object. It is private to this module.
const clientState: ClientState = {
    playerId: null,
    entities: {},
    world: {},
    inventory: {},
    gear: {},
};

// --- State Accessors (Getters) ---

export function getState(): ClientState {
    return clientState;
}

export function setPlayerId(id: string) {
    clientState.playerId = id;
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
    inventory: Record<string, InventoryItem>,
    gear: Record<string, InventoryItem>
) {
    clientState.playerId = playerId;
    clientState.entities = entities; // Directly assign the map
    clientState.world = world;
    clientState.inventory = inventory;
    clientState.gear = gear;
}

export function setEntityPosition(entityId: string, x: number, y: number) {
    if (clientState.entities[entityId]) {
        clientState.entities[entityId].x = x;
        clientState.entities[entityId].y = y;
        clientState.entities[entityId].lastMoveTime = Date.now();
    }
}

// --- UPDATED ---
export function addEntity(id: string, x: number, y: number, type: 'player' | 'npc' | 'item', name?: string, itemId?: string, owner?: string, createdAt?: number, publicAt?: number) {
    clientState.entities[id] = { id, x, y, type, name, itemId, owner, createdAt, publicAt, lastMoveTime: 0 };
}

export function removeEntity(id: string) {
    delete clientState.entities[id];
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

export function setInventory(inventory: Record<string, InventoryItem>) {
    clientState.inventory = inventory;
}

export function setGear(gear: Record<string, InventoryItem>) {
    clientState.gear = gear;
}

export function setEntityChat(entityId: string, message: string) {
    if (clientState.entities[entityId]) {
        clientState.entities[entityId].lastChatMessage = message;
        clientState.entities[entityId].lastChatTimestamp = Date.now();
    }
}