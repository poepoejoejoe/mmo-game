import * as state from './state';

const playerIdEl = document.getElementById('player-id')!;
const cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
const cooldownText = document.getElementById('cooldown-text')!;
const invWood = document.getElementById('inv-wood')!;
const invRock = document.getElementById('inv-rock')!;
const invWoodenWall = document.getElementById('inv-wooden_wall')!;
const craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
const gameCanvas = document.getElementById('game-canvas')!;

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

export function updateCraftingUI(): void {
    const woodCount = state.getState().inventory.wood || 0;
    craftWallBtn.disabled = woodCount < 10;
}

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    invWood.textContent = String(inventory.wood || 0);
    invRock.textContent = String(inventory.rock || 0);
    invWoodenWall.textContent = String(inventory.wooden_wall || 0);
    updateCraftingUI();
}

export function setBuildModeActive(isActive: boolean): void {
    if (isActive) {
        gameCanvas.classList.add('build-mode');
    } else {
        gameCanvas.classList.remove('build-mode');
    }
}

export function updatePlayerIdDisplay() {
    const playerId = state.getState().playerId;
    if (playerId) {
        playerIdEl.textContent = `Your ID: ${playerId}`;
    }
}