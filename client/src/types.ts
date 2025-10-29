// This file acts as the "blueprint" for all our data.
// It ensures that both we and the LLM know the exact shape of our objects.

export interface EntityState {
    id?: string;
    x: number;
    y: number;
    type: 'player' | 'npc' | 'item';
    questState?: 'available' | 'in-progress' | 'turn-in-ready';
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
    gear?: Record<string, InventoryItem>;
    isEcho?: boolean;
}

export interface WorldTile {
    type: string;
    health: number;
    isSanctuary?: boolean;
}

export interface InventoryItem {
    id: string;
    quantity: number;
}

export interface QuestObjective {
    id: string;
    description: string;
    completed: boolean;
}

export interface Quest {
    id: string;
    title: string;
    objectives: QuestObjective[];
    is_complete: boolean;
}

export interface ClientState {
    playerId: string | null;
    entities: Record<string, EntityState>; // Already renamed
    world: Record<string, WorldTile>;
    inventory: Record<string, InventoryItem>; // e.g. "slot_0": { id: "wood", quantity: 50 }
    gear: Record<string, InventoryItem>; // e.g. "weapon-slot": { id: "crude_axe", quantity: 1 }
    quests: Record<string, Quest>;
    experience: Record<string, number>;
    resonance?: number;
    maxResonance?: number;
    echoUnlocked?: boolean;
    lastInteractionPosition: { x: number, y: number } | null;
    activeNpcId: string | null;
    runes: string[];
    activeRune: string;
    knownRecipes: Record<string, boolean>;
    camera: { x: number, y: number };
}

export interface TileProperties {
    isCollidable: boolean;
    isGatherable: boolean;
    isDestructible: boolean;
    isBuildableOn: boolean;
    movementPenalty: boolean;
    gatherResource: string;
    maxHealth: number;
    color: string;
    draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, time: number, tileData: WorldTile) => void;
    asset?: string | string[];
}

export interface ItemProperties {
    text?: string;
    icon?: string;
    character: string;
    color: string;
    asset?: string;
    equippable?: { slot: string, damage?: number, defense?: number };
    draw?: (ctx: CanvasRenderingContext2D, pixelSize: number, direction: string) => void;
    kind?: 'recipe';
}

export interface EntityProperties {
    isAttackable?: boolean;
    asset?: string | string[];
    draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }, props: EntityProperties) => void;
}

export interface NpcQuestStateUpdateMessage extends ServerMessage {
    type: 'npc_quest_state_update';
    npcName: string;
    questState: 'available' | 'in-progress' | 'turn-in-ready';
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
    quests: Record<string, Quest>;
    experience: Record<string, number>;
    resonance?: number;
    maxResonance?: number;
    echoUnlocked?: boolean;
    runes: string[];
    activeRune: string;
    knownRecipes: Record<string, boolean>;
}

export interface RecipeLearnedMessage extends ServerMessage {
    type: 'recipe_learned';
    recipeId: string;
}

export interface ActiveRuneUpdateMessage extends ServerMessage {
    type: 'active_rune_update';
    activeRune: string;
}

export interface QuestUpdateMessage extends ServerMessage {
    type: 'quest_update';
    quests: Record<string, Quest>;
}

export interface EntityMovedMessage extends ServerMessage {
    type: 'entity_moved';
    entityId: string;
    x: number;
    y: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

export interface EntityUpdateMessage extends ServerMessage {
    entityId: string;
    isEcho?: boolean;
    // other fields to update can go here
}

// --- RENAMED and UPDATED ---
export interface EntityJoinedMessage extends ServerMessage {
    type: 'entity_joined'; // <-- RENAMED
    entityId: string;    // <-- RENAMED
    id: string;
    x: number;
    y: number;
    entityType: 'player' | 'npc' | 'item';
    name?: string;
    itemId?: string;
    owner?: string;
    createdAt?: number;
    publicAt?: number;
    shirtColor?: string;
    gear?: Record<string, InventoryItem>;
}

// --- RENAMED and UPDATED ---
export interface EntityLeftMessage extends ServerMessage {
    type: 'entity_left'; // <-- RENAMED
    entityId: string;  // <-- RENAMED
}

export interface PlayerAppearanceChangedMessage extends ServerMessage {
    type: 'player_appearance_changed';
    entityId: string;
    gear: Record<string, InventoryItem>;
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

export interface CraftSuccessMessage extends ServerMessage {
    type: 'craft_success';
    itemId: string;
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
    health?: number;
    maxHealth?: number;
    experience?: Record<string, number>;
    resonance?: number;
    maxResonance?: number;
    echoUnlocked?: boolean;
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

export interface FindPathMessage {
    type: 'find-path';
    payload: { x: number, y: number };
}


// --- Server to Client ---
export interface RegisteredMessage extends ServerMessage {
    type: 'registered';
    secretKey: string;
    playerId: string;
    name: string;
}

export interface DialogMessage extends ServerMessage {
    type: 'show_dialog';
    npcName: string;
    text: string;
    options: DialogOption[];
}

export interface DialogOption {
    text: string;
    action: string;
}

export interface NoValidPathMessage extends ServerMessage {
    type: 'no-valid-path';
}

export interface ValidPathMessage extends ServerMessage {
    type: 'valid-path';
    payload: { directions: string[] };
}