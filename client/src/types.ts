// This file acts as the "blueprint" for all our data.
// It ensures that both we and the LLM know the exact shape of our objects.

export interface EntityState {
    id?: string;
    x: number;
    y: number;
    type: 'player' | 'npc' | 'item';
    itemId?: string;
    owner?: string;
    createdAt?: number;
    publicAt?: number;
    lastChatMessage?: string;
    lastChatTimestamp?: number;
    name?: string;
    lastMoveTime?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    lastAttackTime?: number;
    targetId?: string;
    shirtColor?: string;
}

export interface WorldTile {
    type: string;
    health: number;
}

export interface InventoryItem {
    id: string;
    quantity: number;
}

export interface ClientState {
    playerId: string | null;
    entities: Record<string, EntityState>; // Already renamed
    world: Record<string, WorldTile>;
    inventory: Record<string, InventoryItem>; // e.g. "slot_0": { id: "wood", quantity: 50 }
    gear: Record<string, InventoryItem>; // e.g. "weapon-slot": { id: "crude_axe", quantity: 1 }
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
    inventory: Record<string, InventoryItem>;
    gear: Record<string, InventoryItem>;
}

export interface EntityMovedMessage extends ServerMessage {
    type: 'entity_moved';
    entityId: string;
    x: number;
    y: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

// --- RENAMED and UPDATED ---
export interface EntityJoinedMessage extends ServerMessage {
    type: 'entity_joined'; // <-- RENAMED
    entityId: string;    // <-- RENAMED
    x: number;
    y: number;
    entityType: 'player' | 'npc' | 'item';
    name?: string;
    itemId?: string;
    owner?: string;
    createdAt?: number;
    publicAt?: number;
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
    inventory: Record<string, InventoryItem>;
}

export interface GearUpdateMessage extends ServerMessage {
    type: 'gear_update';
    gear: Record<string, InventoryItem>;
}

export interface StateCorrectionMessage extends ServerMessage {
    type: 'state_correction';
    x: number;
    y: number;
}

export interface EntityAttackMessage extends ServerMessage {
    type: 'entity_attack';
    attackerId: string;
    targetId: string;
}

export interface EntityDamagedMessage extends ServerMessage {
    type: 'entity_damaged';
    entityId: string;
    damage: number;
    x: number;
    y: number;
}

export interface PlayerStatsUpdateMessage extends ServerMessage {
    type: 'player_stats_update';
    health: number;
    maxHealth: number;
}

export interface PlayerChatMessage extends ServerMessage {
    type: 'player_chat';
    playerId: string;
    message: string;
}

export interface SendChatMessage {
    type: 'send_chat';
    message: string;
}

// --- Client to Server ---
export interface ClientLoginMessage {
    type: 'login';
    secretKey?: string;
}

export interface ClientRegisterMessage {
    type: 'register';
    name: string;
}


// --- Server to Client ---
export interface RegisteredMessage extends ServerMessage {
    type: 'registered';
    secretKey: string;
    playerId: string;
    name: string;
}