import * as state from './state';
import * as network from './network';
import { setBuildModeActive, startCooldown, gearView, inventoryView, craftingView, hideDialog } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, WATER_PENALTY } from './constants';
import { getEntityProperties, getTileProperties } from './definitions';

const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const chatInputEl = document.getElementById('chat-input') as HTMLInputElement;
const nameInputEl = document.getElementById('name-input') as HTMLInputElement;
let canPerformAction = true;
let isBuildMode = false;
let buildItem: 'wooden_wall' | 'fire' | null = null;

// State for continuous interaction
let interactionInterval: number | null = null;
let moveInterval: number | null = null;
const pressedKeys: string[] = [];
let isMouseDown = false;
let lastMouseEvent: MouseEvent | null = null;

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

    // --- NEW: Check distance to active NPC ---
    const s = state.getState();
    if (s.activeNpcId) {
        const npc = s.entities[s.activeNpcId];
        const me = state.getMyEntity();
        if (npc && me) {
            const distance = Math.max(Math.abs(me.x - npc.x), Math.abs(me.y - npc.y));
            if (distance > 3) {
                hideDialog();
            }
        }
    }
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
    // If typing in chat or name input, don't process game keybinds
    if (document.activeElement === chatInputEl || document.activeElement === nameInputEl) {
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
    // If typing in chat or name input, don't process game keybinds
    if (document.activeElement === chatInputEl || document.activeElement === nameInputEl) {
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
    const canvasX = lastMouseEvent.clientX - rect.left;
    const canvasY = lastMouseEvent.clientY - rect.top;

    const tileGridX = Math.floor(canvasX / TILE_SIZE);
    const tileGridY = Math.floor(canvasY / TILE_SIZE);
    
    // Dynamically calculate viewport dimensions in CSS pixels
    const viewportWidth = Math.ceil(rect.width / TILE_SIZE);
    const viewportHeight = Math.ceil(rect.height / TILE_SIZE);

    const startX = me.x - Math.floor(viewportWidth / 2);
    const startY = me.y - Math.floor(viewportHeight / 2);
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
    let friendlyNpcId: string | undefined;

    for (const id in entities) {
        const e = entities[id];
        if (e.x === tileX && e.y === tileY) {
            if (e.type === 'item') {
                itemOnTileId = id;
            } else {
                const myPlayerId = state.getState().playerId;
                if(myPlayerId && id !== myPlayerId) {
                    const props = getEntityProperties(e.type, e, myPlayerId);
                    console.log(`[Debug] Checking entity ${id} at (${tileX}, ${tileY}). Type: ${e.type}, Name: ${e.name}, Props:`, props);
                    if (props.isAttackable) {
                        attackableEntityId = id;
                    } else if (e.type === 'npc') {
                        friendlyNpcId = id;
                    }
                }
            }
        }
    }
    
    // Priority 1: Interact with friendly NPC
    if (friendlyNpcId) {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) > 2) return; // a bit more range for talking
        state.setLastInteractionPosition(lastMouseEvent!.clientX, lastMouseEvent!.clientY);
        state.setActiveNpcId(friendlyNpcId);
        network.send({ type: 'interact', payload: { entityId: friendlyNpcId } });

        // Stop the continuous interaction when a dialog is initiated.
        if (interactionInterval) {
            clearInterval(interactionInterval);
            interactionInterval = null;
        }
        
        return;
    }

    // Priority 2: Attack
    if (attackableEntityId) {
        if (Math.abs(me.x - tileX) + Math.abs(me.y - tileY) !== 1) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'attack', payload: { entityId: attackableEntityId } });
        return;
    }

    // Priority 3: Pick up item
    if (itemOnTileId) {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) > 1) return;
        startActionCooldown(ACTION_COOLDOWN);
        network.send({ type: 'interact', payload: { entityId: itemOnTileId } });
        return;
    }

    // Priority 4: Gather resource
    const targetTileProps = getTileProperties(state.getTileData(tileX, tileY).type);
    if (targetTileProps.isGatherable || targetTileProps.isDestructible || state.getTileData(tileX, tileY).type === 'sanctuary_stone') {
        if (Math.max(Math.abs(me.x - tileX), Math.abs(me.y - tileY)) > 1) return;
        state.setLastInteractionPosition(lastMouseEvent!.clientX, lastMouseEvent!.clientY);
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

    inventoryView.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const slot = target.closest('.inventory-slot');
        if (!slot) return;

        if (slot.classList.contains('edible')) {
            if (!canPerformAction) return;
            const itemToEat = (slot as HTMLElement).dataset.item;
            if (itemToEat) {
                startActionCooldown(ACTION_COOLDOWN);
                network.send({ type: 'eat', payload: { item: itemToEat } });
            }
        }
        if (slot.classList.contains('equippable')) {
            if (!canPerformAction) return;
            const inventorySlot = (slot as HTMLElement).dataset.slot;
            if (inventorySlot) {
                startActionCooldown(ACTION_COOLDOWN);
                network.send({ type: 'equip', payload: { inventorySlot } });
            }
        }
    });

    gearView.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const slot = target.closest('.inventory-slot');
        if (!slot || !slot.classList.contains('unequippable')) return;

        if (!canPerformAction) return;
        const gearSlot = (slot as HTMLElement).dataset.slot;
        if (gearSlot) {
            startActionCooldown(ACTION_COOLDOWN);
            network.send({ type: 'unequip', payload: { gearSlot } });
        }
    });

    craftingView.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button || button.disabled || !canPerformAction) return;

        // The item to craft is now stored in the button's ID
        const itemToCraft = button.dataset.item;
        
        if (itemToCraft) {
            startActionCooldown(ACTION_COOLDOWN);
            network.send({ type: 'craft', payload: { item: itemToCraft } });
        }
    });
}


