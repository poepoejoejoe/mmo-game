// This file acts as the "blueprint" for all our data.
// It ensures that both we and the LLM know the exact shape of our objects.

export interface EntityState {
    x: number;
    y: number;
    type: string;
}

export interface WorldTile {
    type: string;
    health: number;
}

export interface ClientState {
    playerId: string | null;
    entities: Record<string, EntityState>; // Already renamed
    world: Record<string, WorldTile>;
    inventory: {
        wood?: number;
        rock?: number;
        wooden_wall?: number;
        [key: string]: number | undefined;
    };
}

// --- WebSocket Message Types ---

export interface ServerMessage {
    type: string;
    [key: string]: any; 
}

export interface InitialStateMessage extends ServerMessage {
    type: 'initial_state';
    playerId: string;
    entities: Record<string, EntityState>; // Already renamed
    world: Record<string, WorldTile>;
    inventory: Record<string, string>;
}

export interface EntityMovedMessage extends ServerMessage {
    type: 'entity_moved';
    entityId: string;
    x: number;
    y: number;
}

// --- RENAMED and UPDATED ---
export interface EntityJoinedMessage extends ServerMessage {
    type: 'entity_joined'; // <-- RENAMED
    entityId: string;    // <-- RENAMED
    x: number;
    y: number;
}

// --- RENAMED and UPDATED ---
export interface EntityLeftMessage extends ServerMessage {
    type: 'entity_left'; // <-- RENAMED
    entityId: string;  // <-- RENAMED
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
    tile: WorldTile;
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

export interface EntityDamagedMessage extends ServerMessage {
    type: 'entity_damaged';
    entityId: string;
    damage: number;
}