import * as state from './state';
import * as network from './network';
import { setBuildModeActive, startCooldown } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WATER_PENALTY } from './constants';
import { getEntityProperties, getTileProperties } from './definitions';

const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
const craftFireBtn = document.getElementById('craft-fire-btn') as HTMLButtonElement;
const craftRatMeatBtn = document.getElementById('craft-rat-meat-btn') as HTMLButtonElement;
const craftCrudeAxeBtn = document.getElementById('craft-crude-axe-btn') as HTMLButtonElement;
const inventorySlotsEl = document.getElementById('inventory-slots')!;
const gearSlotsEl = document.getElementById('gear-slots')!;
const chatInputEl = document.getElementById('chat-input') as HTMLInputElement;
let canPerformAction = true;
let isBuildMode = false;
let buildItem: 'wooden_wall' | 'fire' | null = null;

// State for continuous interaction
let interactionInterval: number | null = null;
let moveInterval: number | null = null;
const pressedKeys: string[] = [];
let isMouseDown = false;
let lastMouseEvent: MouseEvent | null = null;

/**
 * A reusable function that performs a single interaction check and network send.
 * This is called repeatedly when the mouse is held down.
 * @param {number} tileX The world x-coordinate of the target tile.
 * @param {number} tileY The world y-coordinate of the target tile.
 */
function performInteraction(tileX: number, tileY: number) {
    if (!canPerformAction || !state.getMyEntity()) return;

    const me = state.getMyEntity()!;

    // Logic for Build Mode
    if (isBuildMode && buildItem) {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) !== 1) return;

        const inventory = state.getState().inventory;
        const itemCount = Object.values(inventory)
            .filter(item => item?.id === buildItem)
            .reduce((sum, item) => sum + item.quantity, 0);

        if (itemCount < 1) return;
        
        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isBuildableOn) return; // Can't build here

        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: buildItem, x: tileX, y: tileY } });

    } 
    // Logic for Gather/Interact Mode
    else {
        if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
        // --- NEW: Check for item pickup first ---
        const entities = state.getState().entities;
        let itemOnTileId: string | undefined;
        for (const id in entities) {
            const e = entities[id];
            if (e.x === tileX && e.y === tileY && e.type === 'item') {
                itemOnTileId = id;
                break;
            }
        }

        if (itemOnTileId) {
            startActionCooldown(ACTION_COOLDOWN);
            network.send({ type: 'interact', payload: { entityId: itemOnTileId } });
            return;
        }

        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isGatherable && !targetTileProps.isDestructible) return; // Nothing to interact with

        const cooldown = targetTileProps.movementPenalty ? WATER_PENALTY : ACTION_COOLDOWN;
        startActionCooldown(cooldown);
        network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}


function sendMoveCommand(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    if (!canPerformAction || !state.getMyEntity()) return;
    
    const me = state.getMyEntity()!;
    const targetTile = state.getTileData(me.x + dx, me.y + dy);
    const targetProps = getTileProperties(targetTile.type);

    if (targetProps.isCollidable) return;

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


function updateMovement() {
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }

    const lastKey = pressedKeys[pressedKeys.length - 1];
    if (!lastKey) return;

    let dx = 0;
    let dy = 0;

    switch (lastKey) {
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
        default:
            return; // Not a movement key
    }
    
    if (dx === 0 && dy === 0) return;

    sendMoveCommand(dx, dy); // Send first command immediately
    moveInterval = setInterval(() => sendMoveCommand(dx, dy), ACTION_COOLDOWN + 50);
}

function handleMouseMove(e: MouseEvent) {
    if (isMouseDown) {
        lastMouseEvent = e;
    }
}

function handleKeyDown(e: KeyboardEvent) {
    // If typing in chat, don't process game keybinds
    if (document.activeElement === chatInputEl) {
        return;
    }

    // Toggle build mode
    if (e.key === 'b') {
        if (buildItem === 'wooden_wall') {
            isBuildMode = false;
            buildItem = null;
        } else {
            isBuildMode = true;
            buildItem = 'wooden_wall';
        }
        setBuildModeActive(isBuildMode, buildItem);
        return;
    }

    if (e.key === 'f') {
        if (buildItem === 'fire') {
            isBuildMode = false;
            buildItem = null;
        } else {
            isBuildMode = true;
            buildItem = 'fire';
        }
        setBuildModeActive(isBuildMode, buildItem);
        return;
    }

    // Handle movement keys
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!pressedKeys.includes(e.key)) {
            pressedKeys.push(e.key);
            updateMovement();
        }
    }
}

function handleKeyUp(e: KeyboardEvent) {
    // If typing in chat, don't process game keybinds
    if (document.activeElement === chatInputEl) {
        return;
    }
    const index = pressedKeys.indexOf(e.key);
    if (index > -1) {
        pressedKeys.splice(index, 1);
        updateMovement();
    }
}

function handleInteractionLogic() {
    if (!lastMouseEvent || !canPerformAction || !state.getMyEntity()) return;

    const me = state.getMyEntity()!;
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;
    const canvasX = (lastMouseEvent.clientX - rect.left) * scaleX;
    const canvasY = (lastMouseEvent.clientY - rect.top) * scaleY;
    const tileGridX = Math.floor(canvasX / TILE_SIZE);
    const tileGridY = Math.floor(canvasY / TILE_SIZE);
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
    const tileX = tileGridX + startX;
    const tileY = tileGridY + startY;

    // --- Build Mode Logic ---
    if (isBuildMode && buildItem) {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) !== 1) return;

        const inventory = state.getState().inventory;
        const itemCount = Object.values(inventory)
            .filter(item => item?.id === buildItem)
            .reduce((sum, item) => sum + item.quantity, 0);

        if (itemCount < 1) return;
        
        const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
        if (!targetTileProps.isBuildableOn) return;

        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'place_item', payload: { item: buildItem, x: tileX, y: tileY } });
        return;
    }

    // --- Interaction Logic (Attack, Pickup, Gather) ---
    const entities = state.getState().entities;
    let attackableEntityId: string | undefined;
    let itemOnTileId: string | undefined;

    for (const id in entities) {
        const e = entities[id];
        if (e.x === tileX && e.y === tileY) {
            if (e.type === 'item') {
                itemOnTileId = id;
            } else {
                const myPlayerId = state.getState().playerId;
                if(myPlayerId) {
                    const props = getEntityProperties(e.type, id, myPlayerId);
                    if (props.isAttackable) {
                        attackableEntityId = id;
                    }
                }
            }
        }
    }
    
    // Priority 1: Attack
    if (attackableEntityId) {
        if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'attack', payload: { entityId: attackableEntityId } });
        return;
    }

    // Priority 2: Pick up item
    if (itemOnTileId) {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) > 1) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'interact', payload: { entityId: itemOnTileId } });
        return;
    }

    // Priority 3: Gather resource
    const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
    if (targetTileProps.isGatherable || targetTileProps.isDestructible) {
        if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
        const cooldown = targetTileProps.movementPenalty ? WATER_PENALTY : ACTION_COOLDOWN;
        startActionCooldown(cooldown);
        network.send({ type: 'interact', payload: { x: tileX, y: tileY } });
    }
}

function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only respond to left-click for interactions

    isMouseDown = true;
    lastMouseEvent = e;

    handleInteractionLogic();
    
    interactionInterval = setInterval(handleInteractionLogic, ACTION_COOLDOWN + 50);
}

function handleMouseUpOrLeave() {
    isMouseDown = false;
    lastMouseEvent = null;
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
    document.addEventListener('keyup', handleKeyUp);

    chatInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const message = chatInputEl.value.trim();
            if (message) {
                network.send({ type: 'send_chat', payload: { message } });
                chatInputEl.value = '';
                chatInputEl.blur(); // Unfocus the input
            }
        }
    });

    // Replace the single 'click' listener with more detailed mouse events for click-and-hold
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    gameCanvas.addEventListener('mousemove', handleMouseMove);
    // Listen on the whole window to ensure we always catch the mouseup event
    window.addEventListener('mouseup', handleMouseUpOrLeave);
    gameCanvas.addEventListener('mouseleave', handleMouseUpOrLeave);

    inventorySlotsEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('eat-button')) {
            if (!canPerformAction) return;
            const itemToEat = target.dataset.item;
            if (itemToEat) {
                startActionCooldown(ACTION_COOLDOWN);
                network.send({ type: 'eat', payload: { item: itemToEat } });
            }
        }
        if (target.classList.contains('equip-button')) {
            if (!canPerformAction) return;
            const inventorySlot = target.dataset.slot;
            if (inventorySlot) {
                startActionCooldown(ACTION_COOLDOWN);
                network.send({ type: 'equip', payload: { inventorySlot } });
            }
        }
    });

    gearSlotsEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('unequip-button')) {
            if (!canPerformAction) return;
            const gearSlot = target.dataset.slot;
            if (gearSlot) {
                startActionCooldown(ACTION_COOLDOWN);
                network.send({ type: 'unequip', payload: { gearSlot } });
            }
        }
    });

    craftWallBtn.addEventListener('click', () => {
        if (!canPerformAction || craftWallBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'wooden_wall' } });
    });

    craftFireBtn.addEventListener('click', () => {
        if (!canPerformAction || craftFireBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'fire' } });
    });

    craftRatMeatBtn.addEventListener('click', () => {
        if (!canPerformAction || craftRatMeatBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'cooked_rat_meat' } });
    });

    craftCrudeAxeBtn.addEventListener('click', () => {
        if (!canPerformAction || craftCrudeAxeBtn.disabled) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'craft', payload: { item: 'crude_axe' } });
    });
}

