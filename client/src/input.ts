import * as state from './state';
import * as network from './network';
import { setBuildModeActive, startCooldown, gearView, inventoryView, craftingView, hideDialog, closeBankWindow } from './ui';
import { ACTION_COOLDOWN, TILE_SIZE, WATER_PENALTY } from './constants';
import { getEntityProperties, getTileProperties } from './definitions';

let gameCanvas: HTMLCanvasElement;
let nameInputEl: HTMLInputElement;
let canPerformAction = true;
let isBuildMode = false;
let buildItem: 'wooden_wall' | 'fire' | null = null;

// State for continuous interaction
let interactionInterval: number | null = null;
const pressedKeys: string[] = [];
let isMouseDown = false;
let lastMouseEvent: MouseEvent | null = null;
let pathQueue: string[] = [];

export function setPath(path: string[]) {
    pathQueue = path;
    pressedKeys.length = 0;
}

function clearPathQueue() {
    pathQueue = [];
}

function getTileCoordinatesFromMouseEvent(e: MouseEvent): { x: number, y: number } | null {
    const me = state.getMyEntity();
    const camera = state.getState().camera;
    if (!me || !camera) return null;

    const rect = gameCanvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const viewportWidth = rect.width / TILE_SIZE;
    const viewportHeight = rect.height / TILE_SIZE;

    const startX = camera.x - (viewportWidth / 2);
    const startY = camera.y - (viewportHeight / 2);

    const tileX = Math.floor(startX + canvasX / TILE_SIZE);
    const tileY = Math.floor(startY + canvasY / TILE_SIZE);
    
    return { x: tileX, y: tileY };
}

function sendMoveCommand(dx: number, dy: number, isContinuous: boolean = false) {
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
                if (npc.name === 'golem_banker') {
                    closeBankWindow();
                }
            }
        }
    }
}


function updateMovement() {
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

    sendMoveCommand(dx, dy);
}

function handleMouseMove(e: MouseEvent) {
    if (isMouseDown) {
        lastMouseEvent = e;
    }
}

function handleKeyDown(e: KeyboardEvent) {
    // If typing in chat or name input, don't process game keybinds
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    if ((chatInput && document.activeElement === chatInput) || document.activeElement === nameInputEl) {
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
        clearPathQueue();
        if (!pressedKeys.includes(e.key)) {
            pressedKeys.push(e.key);
            updateMovement();
        }
    }
}

function handleKeyUp(e: KeyboardEvent) {
    // If typing in chat or name input, don't process game keybinds
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    if ((chatInput && document.activeElement === chatInput) || document.activeElement === nameInputEl) {
        return;
    }
    const index = pressedKeys.indexOf(e.key);
    if (index > -1) {
        pressedKeys.splice(index, 1);
    }
}

function handleInteractionLogic() {
    if (!lastMouseEvent || !canPerformAction || !state.getMyEntity()) return;

    const me = state.getMyEntity()!;
    const coords = getTileCoordinatesFromMouseEvent(lastMouseEvent);
    if (!coords) return;
    const { x: tileX, y: tileY } = coords;

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
    if (e.button === 0) {
        isMouseDown = true;
        lastMouseEvent = e;

        handleInteractionLogic();
        
        interactionInterval = setInterval(handleInteractionLogic, ACTION_COOLDOWN + 50);
    } else if (e.button === 2) {
        handleRightClick(e);
    }
}

function handleRightClick(e: MouseEvent) {
    clearPathQueue();
    const coords = getTileCoordinatesFromMouseEvent(e);
    if (!coords) return;

    const me = state.getMyEntity();
    if (!me) return;

    // 1. Immediate movement for responsiveness
    const dx = coords.x - me.x;
    const dy = coords.y - me.y;

    let moveDx = 0;
    let moveDy = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
        moveDx = Math.sign(dx);
    } else if (Math.abs(dy) > 0) {
        moveDy = Math.sign(dy);
    } else {
        // Clicked on self, do nothing
        return;
    }
    
    if ((moveDx !== 0 || moveDy !== 0)) {
        sendMoveCommand(moveDx, moveDy, false);
    }

    // --- Drag and Drop Logic ---
    const bankView = document.getElementById('bank-view')!;

    const handleDragStart = (e: DragEvent, sourcePanel: 'inventory' | 'bank') => {
        const target = e.target as HTMLElement;
        const slotEl = target.closest('.inventory-slot') as HTMLElement;
        if (slotEl && slotEl.dataset.slot) {
            const s = state.getState();
            const item = sourcePanel === 'inventory' ? s.inventory[slotEl.dataset.slot] : s.bank[slotEl.dataset.slot];
            if (item) {
                e.dataTransfer!.setData('application/json', JSON.stringify({
                    sourcePanel,
                    slot: slotEl.dataset.slot,
                    quantity: item.quantity
                }));
                e.dataTransfer!.effectAllowed = 'move';
            } else {
                e.preventDefault();
            }
        } else {
             e.preventDefault();
        }
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: DragEvent, targetPanel: 'inventory' | 'bank') => {
        e.preventDefault();
        const data = e.dataTransfer!.getData('application/json');
        if (!data) return;

        try {
            const { sourcePanel, slot, quantity } = JSON.parse(data);
            if (sourcePanel === 'inventory' && targetPanel === 'bank') {
                network.sendDepositItem(slot, quantity);
            } else if (sourcePanel === 'bank' && targetPanel === 'inventory') {
                network.sendWithdrawItem(slot, quantity);
            }
        } catch (err) {
            console.error("Error parsing drag data", err);
        }
    };

    if (inventoryView) {
        inventoryView.addEventListener('dragstart', (e) => handleDragStart(e, 'inventory'));
        inventoryView.addEventListener('dragover', handleDragOver);
        inventoryView.addEventListener('drop', (e) => handleDrop(e, 'inventory'));
    }
    bankView.addEventListener('dragstart', (e) => handleDragStart(e, 'bank'));
    bankView.addEventListener('dragover', handleDragOver);
    bankView.addEventListener('drop', (e) => handleDrop(e, 'bank'));

    // 2. Send find-path request to server
    network.send({ type: 'find-path', payload: { x: coords.x, y: coords.y } });
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

function processPathMovement() {
    if (pathQueue.length > 0 && canPerformAction) {
        const direction = pathQueue.shift();
        if (direction) {
            let dx = 0;
            let dy = 0;
            switch (direction) {
                case 'up': dy = -1; break;
                case 'down': dy = 1; break;
                case 'left': dx = -1; break;
                case 'right': dx = 1; break;
            }
            if (dx !== 0 || dy !== 0) {
                sendMoveCommand(dx, dy, false);
            }
        }
    }
}

/**
 * Sets up all input event listeners for the game.
 */
export function initializeInput() {
    gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    nameInputEl = document.getElementById('name-input') as HTMLInputElement;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Chat input is now handled by React Chat component - no event listener needed here

    // Replace the single 'click' listener with more detailed mouse events for click-and-hold
    gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    gameCanvas.addEventListener('mousemove', handleMouseMove);
    // Listen on the whole window to ensure we always catch the mouseup event
    window.addEventListener('mouseup', handleMouseUpOrLeave);
    gameCanvas.addEventListener('mouseleave', handleMouseUpOrLeave);

    setInterval(processPathMovement, 100);

    if (inventoryView) {
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
    }

    if (gearView) {
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
    }

    if (craftingView) {
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
}


