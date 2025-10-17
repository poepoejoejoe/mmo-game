import * as state from './state';
import * as network from './network';
import { startCooldown, setBuildModeActive } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';

const gameContainer = document.getElementById('game-container')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement; // <-- NEW
let canPerformAction = true;
let isBuildMode = false;

function handleKeyDown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 'b') {
        isBuildMode = !isBuildMode;
        console.log(`Build mode: ${isBuildMode}`);
        setBuildModeActive(isBuildMode); // Update the UI
        return;
    }

    if (!canPerformAction || !state.getMyPlayer()) return;

    let direction: string | null = null;
    switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': direction = 'up'; break;
        case 'arrowdown': case 's': direction = 'down'; break;
        case 'arrowleft': case 'a': direction = 'left'; break;
        case 'arrowright': case 'd': direction = 'right'; break;
        default: return;
    }

    const me = state.getMyPlayer()!;
    let targetX = me.x, targetY = me.y;

    switch (direction) {
        case 'up': targetY--; break;
        case 'down': targetY++; break;
        case 'left': targetX--; break;
        case 'right': targetX++; break;
    }

    // Client-side prediction
    if (Object.values(state.getState().players).some(p => p.x === targetX && p.y === targetY)) return;

    const targetTileData = state.getTileData(targetX, targetY);
    if (['rock', 'tree', 'void'].includes(targetTileData.type)) return;

    // Optimistic update
    state.setPlayerPosition(state.getState().playerId!, targetX, targetY);

    const cooldown = targetTileData.type === 'water' ? WATER_PENALTY : ACTION_COOLDOWN;
    canPerformAction = false;
    startCooldown(cooldown);
    setTimeout(() => canPerformAction = true, cooldown);

    network.send({ type: 'move', payload: { direction } });
}

function handleMouseClick(e: MouseEvent) {
    if (!canPerformAction || !state.getMyPlayer()) return;

    const me = state.getMyPlayer()!;
    const rect = gameContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

    const tileX = Math.floor(clickX / TILE_SIZE) + startX;
    const tileY = Math.floor(clickY / TILE_SIZE) + startY;

    // Check adjacency for any mouse action
    if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;

    // --- UPDATED: Split logic for Gather vs. Build ---
    if (isBuildMode) {
        // --- BUILD LOGIC ---
        const inventory = state.getState().inventory;
        if ((inventory.wooden_wall || 0) < 1) {
            console.log("No walls to place!");
            return; // No walls to place
        }
        
        const targetTileData = state.getTileData(tileX, tileY);
        if (targetTileData.type !== 'ground') {
            console.log("Can only build on ground.");
            return; // Can only build on ground
        }
        
        startCooldownAndSend({ type: 'place_item', payload: { item: 'wooden_wall', x: tileX, y: tileY } });

    } else {
        // --- GATHER/ATTACK LOGIC ---
        const tileData = state.getTileData(tileX, tileY);
        // UPDATED: Now allows clicking on walls
        if (!['tree', 'rock', 'wooden_wall'].includes(tileData.type)) return;

        startCooldownAndSend({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}

/**
 * A helper to start the cooldown and send a network message.
 * @param message The message object to send to the server.
 */
function startCooldownAndSend(message: object) {
    canPerformAction = false;
    startCooldown(ACTION_COOLDOWN);
    setTimeout(() => { canPerformAction = true; }, ACTION_COOLDOWN);
    network.send(message);
}

export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown);
    gameContainer.addEventListener('click', handleMouseClick);

    craftWallBtn.addEventListener('click', () => {
        if (!canPerformAction || craftWallBtn.disabled) return;
        
        canPerformAction = false;
        startCooldown(ACTION_COOLDOWN);
        setTimeout(() => { canPerformAction = true; }, ACTION_COOLDOWN);
        
        // Send the craft request to the server
        network.send({ type: 'craft', payload: { item: 'wooden_wall' } });
    });
}