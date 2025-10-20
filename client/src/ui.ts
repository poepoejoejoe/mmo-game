import * as state from './state';

let playerIdEl: HTMLElement;
let cooldownBar: HTMLDivElement;
let cooldownText: HTMLElement;
let invWood: HTMLElement;
let invRock: HTMLElement;
let invWoodenWall: HTMLElement;
let craftWallBtn: HTMLButtonElement;
let gameCanvas: HTMLElement;
let healthBar: HTMLDivElement;
let healthText: HTMLElement;

export function initializeUI() {
    playerIdEl = document.getElementById('player-id')!;
    cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
    cooldownText = document.getElementById('cooldown-text')!;
    invWood = document.getElementById('inv-wood')!;
    invRock = document.getElementById('inv-rock')!;
    invWoodenWall = document.getElementById('inv-wooden_wall')!;
    craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
    gameCanvas = document.getElementById('game-canvas')!;
    healthBar = document.getElementById('health-bar') as HTMLDivElement;
    healthText = document.getElementById('health-text')!;
}

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

export function updatePlayerHealth(health: number, maxHealth: number) {
    healthText.textContent = `HP: ${health} / ${maxHealth}`;
    const healthPercentage = (health / maxHealth) * 100;
    healthBar.style.width = `${healthPercentage}%`;
}