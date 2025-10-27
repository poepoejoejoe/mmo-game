import { ClientState, WorldTile, EntityState, InventoryItem, Quest } from './types';

// The global client state object. It is private to this module.
const clientState: ClientState = {
    playerId: null,
    entities: {},
    world: {},
    inventory: {},
    gear: {},
    quests: {},
    experience: {},
    lastInteractionPosition: null,
    activeNpcId: null,
    resonance: 0,
    maxResonance: 1,
    echoUnlocked: false,
    runes: [],
    activeRune: '',
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

export function setLastInteractionPosition(x: number, y: number) {
    clientState.lastInteractionPosition = { x, y };
}

export function setActiveNpcId(npcId: string | null) {
    clientState.activeNpcId = npcId;
}

export function setInitialState(
    playerId: string, 
    entities: Record<string, EntityState>, // This map now includes 'type'
    world: Record<string, WorldTile>, 
    inventory: Record<string, InventoryItem>,
    gear: Record<string, InventoryItem>,
    quests: Record<string, Quest>,
    experience: Record<string, number>,
    resonance: number,
    maxResonance: number,
    echoUnlocked: boolean,
    runes: string[],
    activeRune: string,
) {
    clientState.playerId = playerId;
    
    // Process entities to ensure their 'id' field is set from the map key
    const processedEntities: Record<string, EntityState> = {};
    for (const id in entities) {
        processedEntities[id] = {
            ...entities[id],
            id: id 
        };
    }
    clientState.entities = processedEntities;

    clientState.world = world;
    clientState.inventory = inventory;
    clientState.gear = gear;
    clientState.quests = quests;
    clientState.experience = experience;
    clientState.resonance = resonance;
    clientState.maxResonance = maxResonance;
    clientState.echoUnlocked = echoUnlocked;
    clientState.runes = runes;
    clientState.activeRune = activeRune;
}

export function setEntityPosition(entityId: string, x: number, y: number, direction?: 'up' | 'down' | 'left' | 'right') {
    const entity = clientState.entities[entityId];
    if (entity) {
        const positionChanged = entity.x !== x || entity.y !== y;
        let newDirection = direction;

        if (!newDirection && positionChanged) {
            const dx = x - entity.x;
            const dy = y - entity.y;
            if (dx > 0) newDirection = 'right';
            else if (dx < 0) newDirection = 'left';
            else if (dy > 0) newDirection = 'down';
            else if (dy < 0) newDirection = 'up';
        }

        clientState.entities[entityId] = {
            ...entity,
            x,
            y,
            direction: newDirection || entity.direction,
            lastMoveTime: positionChanged ? Date.now() : entity.lastMoveTime
        };
    }
}

// --- UPDATED ---
export function addEntity(entity: EntityState) {
    clientState.entities[entity.id!] = entity;
}

export function removeEntity(id: string) {
    delete clientState.entities[id];
}

export function updateEntity(update: { entityId: string; isEcho?: boolean }) {
    const entity = clientState.entities[update.entityId];
    if (entity) {
        if (update.isEcho !== undefined) {
            entity.isEcho = update.isEcho;
        }
    }
}

export function setActiveRune(rune: string) {
    clientState.activeRune = rune;
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

export function setExperience(experience: Record<string, number>) {
    clientState.experience = experience;
}

export function setMaxResonance(maxResonance: number) {
    clientState.maxResonance = maxResonance;
}

export function setResonance(resonance: number) {
    clientState.resonance = resonance;
}

export function setEchoUnlocked(unlocked: boolean) {
    clientState.echoUnlocked = unlocked;
}

export function setInventory(inventory: Record<string, InventoryItem>) {
    clientState.inventory = inventory;
}

export function setQuests(quests: Record<string, Quest>) {
    clientState.quests = quests;
}

export function setGear(gear: Record<string, InventoryItem>) {
    clientState.gear = gear;
}

export function setEntityGear(entityId: string, gear: Record<string, InventoryItem>) {
    const entity = clientState.entities[entityId];
    if (entity) {
        entity.gear = gear;
    }
}

export function setEntityChat(entityId: string, message: string) {
    if (clientState.entities[entityId]) {
        clientState.entities[entityId].lastChatMessage = message;
        clientState.entities[entityId].lastChatTimestamp = Date.now();
    }
}

export function setEntityAttack(attackerId: string, targetId: string) {
    const entity = clientState.entities[attackerId];
    if (entity) {
        clientState.entities[attackerId] = { ...entity, lastAttackTime: Date.now(), targetId: targetId };
    }
}

export function updateNpcQuestState(npcName: string, questState: any) {
    for (const entityId in clientState.entities) {
        const entity = clientState.entities[entityId];
        if (entity.type === 'npc' && entity.name === npcName) {
            entity.questState = questState;
        }
    }
}