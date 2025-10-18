import * as state from './state';
import * as network from './network';
import { startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';

const gameCanvas = document.getElementById('game-canvas')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
let canPerformAction = true;
let isBuildMode = false;

function handleKeyDown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'b') {
        isBuildMode = !isBuildMode;
        console.log(`Build mode: ${isBuildMode}`);
        document.getElementById('game-canvas')!.classList.toggle('build-mode', isBuildMode);
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

    // Optimistic update
    state.setPlayerPosition(state.getState().playerId!, targetX, targetY);

    const cooldown = targetTileData.type === 'water' ? WATER_PENALTY : ACTION_COOLDOWN;
    startActionCooldown(cooldown);

    network.send({ type: 'move', payload: { direction } });
}

function handleMouseClick(e: MouseEvent) {
    if (!canPerformAction || !state.getMyPlayer()) return;

    const me = state.getMyPlayer()!;
    const rect = gameCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel coordinates to tile coordinates within the viewport
    const viewTileX = Math.floor(clickX / TILE_SIZE);
    const viewTileY = Math.floor(clickY / TILE_SIZE);

    // Convert viewport tile coordinates to world coordinates
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
    const worldTileX = startX + viewTileX;
    const worldTileY = startY + viewTileY;

    if (Math.abs(me.x - worldTileX) + Math.abs(me.y - worldTileY) !== 1) return;

    const tileData = state.getTileData(worldTileX, worldTileY);

    if (isBuildMode) {
        if ((state.getState().inventory.wooden_wall || 0) < 1) return;
        if (tileData.type !== 'ground') return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: 'wooden_wall', x: worldTileX, y: worldTileY } });
    } else {
        if (!['tree', 'rock', 'wooden_wall'].includes(tileData.type)) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'interact', payload: { x: worldTileX, y: worldTileY } });
    }
}

function startActionCooldown(duration: number) {
    canPerformAction = false;
    startCooldown(duration);
    setTimeout(() => { canPerformAction = true; }, duration);
}

export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown);
    gameCanvas.addEventListener('click', handleMouseClick);
    craftWallBtn.addEventListener('click', () => {
        if (!canPerformAction || craftWallBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'wooden_wall' } });
    });
}
