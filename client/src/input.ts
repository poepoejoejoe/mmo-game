import * as state from './state';
import * as network from './network';
import { setBuildModeActive, startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';
import { getTileProperties } from './definitions';

const gameCanvas = document.getElementById('game-canvas')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
let canPerformAction = true;
let isBuildMode = false;

// State for continuous interaction
let interactionInterval: number | null = null;

/**
 * A reusable function that performs a single interaction check and network send.
 * This is called repeatedly when the mouse is held down.
 * @param {number} tileX The world x-coordinate of the target tile.
 * @param {number} tileY The world y-coordinate of the target tile.
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

        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isBuildableOn) return;

        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: 'wooden_wall', x: tileX, y: tileY } });

    // Logic for Gather/Attack Mode
    } else {
        const tileData = state.getTileData(tileX, tileY);
        const props = getTileProperties(tileData.type);
        if (!props.isGatherable && !props.isDestructible) return;

        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}

function handleKeyDown(e: KeyboardEvent) {
    // Toggling build mode
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

    // Client-side prediction for player collision
    if (Object.values(state.getState().players).some(p => p.x === targetX && p.y === targetY)) return;

    // Client-side prediction for terrain collision
    const targetTileData = state.getTileData(targetX, targetY);
    const props = getTileProperties(targetTileData.type);
    if (props.isCollidable) return;

    // Optimistic update for responsive feel
    state.setPlayerPosition(state.getState().playerId!, targetX, targetY);

    const cooldown = props.movementPenalty ? WATER_PENALTY : ACTION_COOLDOWN;
    startActionCooldown(cooldown);

    network.send({ type: 'move', payload: { direction } });
}

function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Ignore right-clicks

    if (interactionInterval) {
        clearInterval(interactionInterval);
    }

    const tryInteraction = () => {
        const me = state.getMyPlayer();
        if (!me) return;

        const rect = gameCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
        const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
        const tileX = Math.floor(clickX / TILE_SIZE) + startX;
        const tileY = Math.floor(clickY / TILE_SIZE) + startY;

        performInteraction(tileX, tileY);
    };

    tryInteraction(); // Fire once immediately on click
    // Then set an interval to repeat the action while the mouse is held down
    interactionInterval = setInterval(tryInteraction, ACTION_COOLDOWN + 50);
}

function handleMouseUpOrLeave() {
    // When the mouse is released or leaves the canvas, stop the continuous interaction
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

/**
 * Sets up all input event listeners for the game.
 */
export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown);

    // Replace the single 'click' listener with more detailed mouse events for click-and-hold
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    // Listen on the whole window to ensure we always catch the mouseup event
    window.addEventListener('mouseup', handleMouseUpOrLeave);
    gameCanvas.addEventListener('mouseleave', handleMouseUpOrLeave);

    craftWallBtn.addEventListener('click', () => {
        if (!canPerformAction || craftWallBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'wooden_wall' } });
    });
}
