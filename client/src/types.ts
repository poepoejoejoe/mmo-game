// This file acts as the "blueprint" for all our data.
// It ensures that both we and the LLM know the exact shape of our objects.

export interface PlayerState {
    x: number;
    y: number;
}

export interface WorldTile {
    type: string;
    health: number;
}

export interface ClientState {
    playerId: string | null;
    players: Record<string, PlayerState>;
    world: Record<string, WorldTile>;
    inventory: Record<string, number>;
}

// --- WebSocket Message Types ---

// A generic wrapper for all messages from the server
export interface ServerMessage {
    type: string;
    // We'll cast the payload later based on the type
    [key: string]: any; 
}

export interface InitialStateMessage extends ServerMessage {
    type: 'initial_state';
    playerId: string;
    players: Record<string, PlayerState>;
    world: Record<string, WorldTile>;
    inventory: Record<string, string>; // Comes as string from Redis
}

export interface PlayerMovedMessage extends ServerMessage {
    type: 'player_moved';
    playerId: string;
    x: number;
    y: number;
}

export interface PlayerJoinedMessage extends ServerMessage {
    type: 'player_joined';
    playerId: string;
    x: number;
    y: number;
}

export interface PlayerLeftMessage extends ServerMessage {
    type: 'player_left';
    playerId: string;
}

export interface ResourceDamagedMessage extends ServerMessage {
    type: 'resource_damaged';
    x: number;
    y: number;
    newHealth: number;
}

export interface WorldUpdateMessage extends ServerMessage {
    type: 'world_update';
    x: number;
    y: number;
    tile: string;
}

export interface InventoryUpdateMessage extends ServerMessage {
    type: 'inventory_update';
    resource: string;
    amount: number;
}

export interface StateCorrectionMessage extends ServerMessage {
    type: 'state_correction';
    x: number;
    y: number;
}
