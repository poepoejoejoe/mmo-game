import { ClientState, WorldTile, PlayerState } from './types';

// The global client state object. It is private to this module.
const clientState: ClientState = {
    playerId: null,
    players: {},
    world: {},
    inventory: {}
};

// --- State Accessors (Getters) ---

export function getState(): ClientState {
    return clientState;
}

export function getMyPlayer(): PlayerState | undefined {
    if (!clientState.playerId) return undefined;
    return clientState.players[clientState.playerId];
}

export function getTileData(x: number, y: number): WorldTile {
    const key = `${x},${y}`;
    return clientState.world[key] || { type: 'void', health: 0 };
}

// --- State Mutators (Setters) ---

export function setInitialState(
    playerId: string, 
    players: Record<string, PlayerState>, 
    world: Record<string, WorldTile>, 
    inventory: Record<string, string>
) {
    clientState.playerId = playerId;
    clientState.players = players;
    clientState.world = world;
    for (const resource in inventory) {
        clientState.inventory[resource] = parseInt(inventory[resource], 10);
    }
}

export function setPlayerPosition(playerId: string, x: number, y: number) {
    if (clientState.players[playerId]) {
        clientState.players[playerId].x = x;
        clientState.players[playerId].y = y;
    }
}

export function addPlayer(playerId: string, x: number, y: number) {
    clientState.players[playerId] = { x, y };
}

export function removePlayer(playerId: string) {
    delete clientState.players[playerId];
}

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