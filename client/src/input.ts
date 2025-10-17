import * as state from './state';
import * as network from './network';
import { startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';

const gameContainer = document.getElementById('game-container')!;
let canPerformAction = true;

function handleKeyDown(e: KeyboardEvent) {
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
    state.setPlayerPosition(me.id, targetX, targetY);

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

    if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;

    const tileData = state.getTileData(tileX, tileY);
    if (!['tree', 'rock'].includes(tileData.type)) return;

    canPerformAction = false;
    startCooldown(ACTION_COOLDOWN);
    setTimeout(() => canPerformAction = true, ACTION_COOLDOWN);
    
    network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
}

export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown);
    gameContainer.addEventListener('click', handleMouseClick);
}