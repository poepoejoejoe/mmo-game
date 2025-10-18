import * as state from './state';
import * as network from './network';
import { setBuildModeActive, startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';
import { getTileProperties } from './definitions';

const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
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
    if (!canPerformAction || !state.getMyEntity()) return; // <-- UPDATED

    const me = state.getMyEntity()!; // <-- UPDATED
    // Check adjacency for any mouse action
    if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;

    // Logic for Build Mode
    if (isBuildMode) {
        const inventory = state.getState().inventory;
        if ((inventory.wooden_wall || 0) < 1) return; // Not enough walls
        
        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isBuildableOn) return; // Can't build here

        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: 'wooden_wall', x: tileX, y: tileY } });

    } 
    // Logic for Gather/Interact Mode
    else {
        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isGatherable && !targetTileProps.isDestructible) return; // Nothing to interact with

        const cooldown = targetTileProps.movementPenalty ? WATER_PENALTY : ACTION_COOLDOWN;
        startActionCooldown(cooldown);
        network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}


function handleKeyDown(e: KeyboardEvent) {
    if (!canPerformAction || !state.getMyEntity()) return; // <-- UPDATED

    let dx = 0;
    let dy = 0;

    switch (e.key) {
        case 'w':
        case 'ArrowUp':
            dy = -1;
            break;
        case 's':
        case 'ArrowDown':
            dy = 1;
            break;
        case 'a':
        case 'ArrowLeft':
            dx = -1;
            break;
        case 'd':
        case 'ArrowRight':
            dx = 1;
            break;
        case 'b': // Build mode toggle
            isBuildMode = !isBuildMode;
            setBuildModeActive(isBuildMode);
            return; // Don't perform a move action
        default:
            return; // Ignore other keys
    }

    if (dx === 0 && dy === 0) return;
    
    const me = state.getMyEntity()!; // <-- UPDATED
    const targetTile = state.getTileData(me.x + dx, me.y + dy);
    const targetProps = getTileProperties(targetTile.type);

    if (targetProps.isCollidable) return; // Don't send move if it's a wall

    const cooldown = targetProps.movementPenalty ? WATER_PENALTY : ACTION_COOLDOWN;
    startActionCooldown(cooldown);

    const directionMap: { [key: string]: string } = {
        '-1,0': 'left',
        '1,0': 'right',
        '0,-1': 'up',
        '0,1': 'down',
    };
    const dirKey = `${dx},${dy}`;
    network.send({ type: 'move', payload: { direction: directionMap[dirKey] } });
}

function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only respond to left-click

    const tryInteraction = () => {
        const me = state.getMyEntity(); // <-- UPDATED
        if (!me) return;

        const rect = gameCanvas.getBoundingClientRect();
        const scaleX = gameCanvas.width / rect.width;
        const scaleY = gameCanvas.height / rect.height;

        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        const tileGridX = Math.floor(canvasX / TILE_SIZE);
        const tileGridY = Math.floor(canvasY / TILE_SIZE);

        const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
        const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

        const tileX = tileGridX + startX;
        const tileY = tileGridY + startY;

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
