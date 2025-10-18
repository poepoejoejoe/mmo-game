import * as state from './state';
import * as network from './network';
// --- THIS IS THE FIX: Only import functions that actually exist in ui.ts ---
import { setBuildModeActive, startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';

const gameCanvas = document.getElementById('game-canvas')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
let canPerformAction = true;
let isBuildMode = false;

// State for continuous interaction
let interactionInterval: number | null = null;

/**
 * A reusable function that performs a single interaction check and network send.
 */
function performInteraction(tileX: number, tileY: number) {
    if (!canPerformAction || !state.getMyPlayer()) return;

    const me = state.getMyPlayer()!;
    // Check adjacency for any mouse action
    if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
    
    // Logic for Build Mode
    if (isBuildMode) {
        const inventory = state.getState().inventory;
        if ((inventory.wooden_wall || 0) < 1) return;
        const targetTileData = state.getTileData(tileX, tileY);
        if (targetTileData.type !== 'ground') return;
        
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: 'wooden_wall', x: tileX, y: tileY } });
        
    // Logic for Gather/Attack Mode
    } else {
        const tileData = state.getTileData(tileX, tileY);
        if (!['tree', 'rock', 'wooden_wall'].includes(tileData.type)) return;
        
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}


function handleKeyDown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'b') {
        isBuildMode = !isBuildMode;
        console.log(`Build mode: ${isBuildMode}`);
        setBuildModeActive(isBuildMode);
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

    if (Object.values(state.getState().players).some(p => p.x === targetX && p.y === targetY)) return;
    const targetTileData = state.getTileData(targetX, targetY);
    if (['rock', 'tree', 'void', 'wooden_wall'].includes(targetTileData.type)) return;

    state.setPlayerPosition(state.getState().playerId!, targetX, targetY);

    const cooldown = targetTileData.type === 'water' ? WATER_PENALTY : ACTION_COOLDOWN;
    startActionCooldown(cooldown);

    network.send({ type: 'move', payload: { direction } });
}

function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;

    if (interactionInterval) {
        clearInterval(interactionInterval);
    }
    
    const tryInteraction = () => {
        const me = state.getMyPlayer();
        if (!me) return;
        
        // This is a simplified approach. A better one would track the mouse's current position,
        // but for this game, assuming the mouse stays over the same tile is okay.
        const rect = gameCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
        const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
        const tileX = Math.floor(clickX / TILE_SIZE) + startX;
        const tileY = Math.floor(clickY / TILE_SIZE) + startY;
        
        performInteraction(tileX, tileY);
    };

    tryInteraction(); // Fire once immediately
    interactionInterval = setInterval(tryInteraction, ACTION_COOLDOWN + 50); // Repeat
}

function handleMouseUpOrLeave() {
    if (interactionInterval) {
        clearInterval(interactionInterval);
        interactionInterval = null;
    }
}

function startActionCooldown(duration: number) {
    canPerformAction = false;
    startCooldown(duration);
    setTimeout(() => { canPerformAction = true; }, duration);
}

export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown);
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUpOrLeave);
    gameCanvas.addEventListener('mouseleave', handleMouseUpOrLeave);

    craftWallBtn.addEventListener('click', () => {
        if (!canPerformAction || craftWallBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'wooden_wall' } });
    });
}