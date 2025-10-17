import * as state from './state';
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from './constants';

const gameContainer = document.getElementById('game-container')!;
const playerCoordsEl = document.getElementById('player-coords')!;
const playerIdEl = document.getElementById('player-id')!;
const cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
const cooldownText = document.getElementById('cooldown-text')!;
const invWood = document.getElementById('inv-wood')!;
const invRock = document.getElementById('inv-rock')!;
const invWoodenWall = document.getElementById('inv-wooden_wall')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement; // <-- NEW

export function startCooldown(duration: number): void {
    cooldownText.textContent = "Working...";
    cooldownBar.style.transform = "translateX(-100%)";
    cooldownBar.style.transition = "none";
    cooldownBar.offsetHeight;
    cooldownBar.style.transition = `transform ${duration}ms linear`;
    cooldownBar.style.transform = "translateX(0%)";
    setTimeout(() => {
        cooldownText.textContent = "Ready";
    }, duration);
}

/**
 * Updates the crafting UI based on the player's current inventory.
 */
export function updateCraftingUI(): void {
    const inventory = state.getState().inventory;
    const woodCount = inventory.wood || 0;
    
    // Enable the button only if the player has enough wood
    craftWallBtn.disabled = woodCount < 10;
}

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    invWood.textContent = String(inventory.wood || 0);
    invRock.textContent = String(inventory.rock || 0);
    invWoodenWall.textContent = String(inventory.wooden_wall || 0); // <-- NEW

    // Also update the crafting UI whenever inventory changes
    updateCraftingUI();
}

// --- NEW FUNCTION ---
/**
 * Toggles the visual indicators for build mode.
 * @param {boolean} isActive Whether build mode should be active.
 */
export function setBuildModeActive(isActive: boolean): void {
    if (isActive) {
        gameContainer.classList.add('build-mode');
    } else {
        gameContainer.classList.remove('build-mode');
    }
}

export function showHitEffect(x: number, y: number) {
    const me = state.getMyPlayer();
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

export function renderViewport() {
    const me = state.getMyPlayer();
    const clientState = state.getState();
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

            const playerOnTile = Object.keys(clientState.players).find(pId =>
                clientState.players[pId].x === worldX && clientState.players[pId].y === worldY
            );

            const tileData = state.getTileData(worldX, worldY);
            let finalClass = 'grid-cell ';
            finalClass += playerOnTile
                ? (playerOnTile === clientState.playerId ? 'player' : 'other-player')
                : tileData.type;
            cell.className = finalClass;

            // --- THIS IS THE UPDATED LOGIC ---
            if (tileData.type === 'tree' || tileData.type === 'rock' || tileData.type === 'wooden_wall') {
                let maxHealth = 1;
                if (tileData.type === 'tree') maxHealth = 2;
                if (tileData.type === 'rock') maxHealth = 4;
                if (tileData.type === 'wooden_wall') maxHealth = 10;

                // Only show cracks if the resource is actually damaged
                if (tileData.health < maxHealth) {
                    const crackOverlay = document.createElement('div');
                    const damagePercent = 1 - (tileData.health / maxHealth);
                    // Use Math.min to ensure we never try to render a non-existent crack-10
                    const crackStage = Math.min(9, Math.floor(damagePercent * 10));
                    
                    crackOverlay.className = `crack-overlay crack-${crackStage}`;
                    cell.appendChild(crackOverlay);
                }
            }
            // --- END OF UPDATED LOGIC ---

            gameContainer.appendChild(cell);
        }
    }
    playerCoordsEl.textContent = `Your Position: (${me.x}, ${me.y})`;
    if (clientState.playerId) {
        playerIdEl.textContent = `Your ID: ${clientState.playerId}`;
    }
}

/**
 * Finds a specific tile in the DOM and updates its crack overlay.
 * This is used for targeted updates without a full re-render.
 * @param {number} x The world x-coordinate of the tile.
 * @param {number} y The world y-coordinate of the tile.
 */
export function updateTile(x: number, y: number) {
    const me = state.getMyPlayer();
    if (!me) return;

    // Calculate the tile's position within the current viewport
    const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
    const halfHeight = Math.floor(VIEWPORT_HEIGHT / 2);
    const viewX = x - (me.x - halfWidth);
    const viewY = y - (me.y - halfHeight);
    
    if (viewX >= 0 && viewX < VIEWPORT_WIDTH && viewY >= 0 && viewY < VIEWPORT_HEIGHT) {
        const cellIndex = viewY * VIEWPORT_WIDTH + viewX;
        const cell = gameContainer.children[cellIndex];
        if (cell) {
            // Remove any existing crack overlay
            const existingOverlay = cell.querySelector('.crack-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            // Add the new, updated crack overlay
            const tileData = state.getTileData(x, y);
            let maxHealth = 1;
            if (tileData.type === 'tree') maxHealth = 2;
            if (tileData.type === 'rock') maxHealth = 4;
            if (tileData.type === 'wooden_wall') maxHealth = 10;

            if (tileData.health < maxHealth) {
                const crackOverlay = document.createElement('div');
                const damagePercent = 1 - (tileData.health / maxHealth);
                // Use Math.min to ensure we don't go past crack-9
                const crackStage = Math.min(9, Math.floor(damagePercent * 10));
                
                crackOverlay.className = `crack-overlay crack-${crackStage}`;
                cell.appendChild(crackOverlay);
            }
        }
    }
}