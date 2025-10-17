// Import our type definitions and styles
import './styles.css';
import { 
    ClientState, 
    InitialStateMessage, 
    PlayerMovedMessage, 
    PlayerJoinedMessage, 
    PlayerLeftMessage, 
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage,
    InventoryUpdateMessage
} from './types';

// --- Element Caching ---
// The '!' tells TypeScript we are certain these elements exist in our HTML.
const gameContainer = document.getElementById('game-container')!;
const playerCoordsEl = document.getElementById('player-coords')!;
const playerIdEl = document.getElementById('player-id')!;
const cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
const cooldownText = document.getElementById('cooldown-text')!;
const invWood = document.getElementById('inv-wood')!;
const invRock = document.getElementById('inv-rock')!;

// --- WebSocket Setup ---
// The WebSocket URL is now relative. Vite's proxy will handle forwarding it.
const ws = new WebSocket(`ws://${window.location.host}/ws`);

// --- Game Configuration ---
const VIEWPORT_WIDTH = 31;
const VIEWPORT_HEIGHT = 21;
const TILE_SIZE = 20;

// --- Client-Side State ---
// Our state object is now strongly typed using the ClientState interface.
const clientState: ClientState = {
    playerId: null,
    players: {},
    world: {},
    inventory: {}
};

// --- Cooldown Management ---
let canPerformAction = true;
const ACTION_COOLDOWN = 100;
const WATER_PENALTY = 500;

/**
 * Starts the visual cooldown timer in the UI.
 * @param duration The duration of the cooldown in milliseconds.
 */
function startCooldown(duration: number): void {
    canPerformAction = false;
    cooldownText.textContent = "Working...";
    cooldownBar.style.transform = "translateX(-100%)";
    cooldownBar.style.transition = "none";
    cooldownBar.offsetHeight;
    cooldownBar.style.transition = `transform ${duration}ms linear`;
    cooldownBar.style.transform = "translateX(0%)";
    setTimeout(() => {
        canPerformAction = true;
        cooldownText.textContent = "Ready";
    }, duration);
}

/**
 * Updates the inventory display with the latest counts.
 */
function updateInventoryUI(): void {
    invWood.textContent = String(clientState.inventory.wood || 0);
    invRock.textContent = String(clientState.inventory.rock || 0);
}

// --- WebSocket Event Handlers ---

ws.onopen = (): void => {
    console.log('Connected to the server.');
    playerCoordsEl.textContent = 'Connected! Waiting for world state...';
    document.addEventListener('keydown', handleKeyDown);
    gameContainer.addEventListener('click', handleMouseClick);
};

ws.onmessage = (event: MessageEvent): void => {
    const msg: ServerMessage = JSON.parse(event.data);

    switch (msg.type) {
        case 'initial_state': {
            const stateMsg = msg as InitialStateMessage;
            clientState.playerId = stateMsg.playerId;
            clientState.players = stateMsg.players;
            clientState.world = stateMsg.world;
            // Convert string values from Redis to numbers for inventory
            for(const resource in stateMsg.inventory) {
                clientState.inventory[resource] = parseInt(stateMsg.inventory[resource], 10);
            }
            updateInventoryUI();
            playerIdEl.textContent = `Your ID: ${stateMsg.playerId}`;
            break;
        }
        case 'state_correction': {
            const correctMsg = msg as StateCorrectionMessage;
            const me = clientState.players[clientState.playerId!];
            if (me) {
                me.x = correctMsg.x;
                me.y = correctMsg.y;
            }
            break;
        }
        case 'resource_damaged': {
            const damageMsg = msg as ResourceDamagedMessage;
            const key = `${damageMsg.x},${damageMsg.y}`;
            if (clientState.world[key]) {
                clientState.world[key].health = damageMsg.newHealth;
                showHitEffect(damageMsg.x, damageMsg.y);
            }
            break;
        }
        case 'player_moved': {
            const moveMsg = msg as PlayerMovedMessage;
            if (clientState.players[moveMsg.playerId]) {
                clientState.players[moveMsg.playerId].x = moveMsg.x;
                clientState.players[moveMsg.playerId].y = moveMsg.y;
            }
            break;
        }
        case 'player_joined': {
            const joinMsg = msg as PlayerJoinedMessage;
            clientState.players[joinMsg.playerId] = { x: joinMsg.x, y: joinMsg.y };
            break;
        }
        case 'player_left': {
            const leftMsg = msg as PlayerLeftMessage;
            delete clientState.players[leftMsg.playerId];
            break;
        }
        case 'world_update': {
            const updateMsg = msg as WorldUpdateMessage;
            const key = `${updateMsg.x},${updateMsg.y}`;
            if (clientState.world[key]) {
                clientState.world[key].type = updateMsg.tile;
                clientState.world[key].health = 0;
            }
            break;
        }
        case 'inventory_update': {
            const invMsg = msg as InventoryUpdateMessage;
            clientState.inventory[invMsg.resource] = invMsg.amount;
            updateInventoryUI();
            break;
        }
    }
    renderViewport();
};

ws.onclose = (): void => {
    console.log('Disconnected from the server.');
    playerCoordsEl.textContent = 'Disconnected. Please refresh.';
    document.removeEventListener('keydown', handleKeyDown);
    gameContainer.removeEventListener('click', handleMouseClick);
};

// ... (rest of the file is very similar, just with types added)

function getTileData(x: number, y: number) {
    const key = `${x},${y}`;
    return clientState.world[key] || { type: 'void', health: 0 };
}

function showHitEffect(x: number, y: number) {
    const me = clientState.players[clientState.playerId!];
    if (!me) return;
    const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
    const halfHeight = Math.floor(VIEWPORT_HEIGHT / 2);
    const viewX = x - (me.x - halfWidth);
    const viewY = y - (me.y - halfHeight);
    if (viewX >= 0 && viewX < VIEWPORT_WIDTH && viewY >= 0 && viewY < VIEWPORT_HEIGHT) {
        const cellIndex = viewY * VIEWPORT_WIDTH + viewX;
        const cell = gameContainer.children[cellIndex];
        if (cell) {
            const hitEffect = document.createElement('div');
            hitEffect.className = 'hit-effect';
            cell.appendChild(hitEffect);
            setTimeout(() => hitEffect.remove(), 200);
        }
    }
}

function renderViewport() {
    const me = clientState.players[clientState.playerId!];
    if (!me) return;
    gameContainer.innerHTML = '';
    gameContainer.style.gridTemplateColumns = `repeat(${VIEWPORT_WIDTH}, 20px)`;
    gameContainer.style.gridTemplateRows = `repeat(${VIEWPORT_HEIGHT}, 20px)`;
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
    for (let j = 0; j < VIEWPORT_HEIGHT; j++) {
        for (let i = 0; i < VIEWPORT_WIDTH; i++) {
            const cell = document.createElement('div');
            const worldX = startX + i;
            const worldY = startY + j;
            let playerOnTile = Object.keys(clientState.players).find(pId => 
                clientState.players[pId].x === worldX && clientState.players[pId].y === worldY
            );
            const tileData = getTileData(worldX, worldY);
            let finalClass = 'grid-cell ';
            finalClass += playerOnTile 
                ? (playerOnTile === clientState.playerId ? 'player' : 'other-player') 
                : tileData.type;
            cell.className = finalClass;
            if (tileData.type === 'tree' || tileData.type === 'rock') {
                const overlay = document.createElement('div');
                overlay.className = 'damage-overlay';
                const maxHealth = tileData.type === 'tree' ? 2 : 4;
                overlay.style.opacity = String(1 - (Math.max(0, tileData.health) / maxHealth));
                cell.appendChild(overlay);
            }
            gameContainer.appendChild(cell);
        }
    }
    playerCoordsEl.textContent = `Your Position: (${me.x}, ${me.y})`;
}

function handleKeyDown(e: KeyboardEvent) {
    if (!canPerformAction || !clientState.playerId) return;
    let direction: string | null = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': direction = 'up'; break;
        case 'arrowdown': case 's': direction = 'down'; break;
        case 'arrowleft': case 'a': direction = 'left'; break;
        case 'arrowright': case 'd': direction = 'right'; break;
        default: return;
    }
    const me = clientState.players[clientState.playerId!];
    let targetX = me.x, targetY = me.y;
    switch (direction) {
        case 'up': targetY--; break;
        case 'down': targetY++; break;
        case 'left': targetX--; break;
        case 'right': targetX++; break;
    }
    if (Object.values(clientState.players).some(p => p.x === targetX && p.y === targetY)) return;
    const targetTileData = getTileData(targetX, targetY);
    if (['rock', 'tree', 'void'].includes(targetTileData.type)) return;
    me.x = targetX;
    me.y = targetY;
    renderViewport();
    const cooldown = targetTileData.type === 'water' ? WATER_PENALTY : ACTION_COOLDOWN;
    startCooldown(cooldown);
    ws.send(JSON.stringify({ type: 'move', payload: { direction } }));
}

function handleMouseClick(e: MouseEvent) {
    if (!canPerformAction || !clientState.playerId) return;
    const me = clientState.players[clientState.playerId!];
    if (!me) return;
    const rect = gameContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
    const tileX = Math.floor(clickX / TILE_SIZE) + startX;
    const tileY = Math.floor(clickY / TILE_SIZE) + startY;
    if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
    const tileData = getTileData(tileX, tileY);
    if (!['tree', 'rock'].includes(tileData.type)) return;
    startCooldown(ACTION_COOLDOWN);
    ws.send(JSON.stringify({ type: 'interact', payload: { x: tileX, y: tileY } }));
}
