import * as state from './state';
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from './constants';

const gameContainer = document.getElementById('game-container')!;
const playerCoordsEl = document.getElementById('player-coords')!;
const playerIdEl = document.getElementById('player-id')!;
const cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
const cooldownText = document.getElementById('cooldown-text')!;
const invWood = document.getElementById('inv-wood')!;
const invRock = document.getElementById('inv-rock')!;

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

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    invWood.textContent = String(inventory.wood || 0);
    invRock.textContent = String(inventory.rock || 0);
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

            if (tileData.type === 'tree' || tileData.type === 'rock') {
                const overlay = document.createElement('div');
                overlay.className = 'damage-overlay';
                const maxHealth = tileData.type === 'tree' ? 2 : 4;
                overlay.style.opacity = String(1 - (Math.max(0, tileData.health) / maxHealth));
                cell.appendChild(overlay);
            }
            gameContainer.appendChild(cell);
        }
    }
    playerCoordsEl.textContent = `Your Position: (${me.x}, ${me.y})`;
    if(clientState.playerId) {
        playerIdEl.textContent = `Your ID: ${clientState.playerId}`;
    }
}