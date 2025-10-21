import * as state from './state';

let playerIdEl: HTMLElement;
let cooldownBar: HTMLDivElement;
let cooldownText: HTMLElement;
let inventorySlotsEl: HTMLElement;
let craftWallBtn: HTMLButtonElement;
let craftFireBtn: HTMLButtonElement;
let gameCanvas: HTMLElement;
let healthBar: HTMLDivElement;
let healthText: HTMLElement;
let buildModeIndicator: HTMLElement;

export function initializeUI() {
    playerIdEl = document.getElementById('player-id')!;
    cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
    cooldownText = document.getElementById('cooldown-text')!;
    inventorySlotsEl = document.getElementById('inventory-slots')!;
    craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
    craftFireBtn = document.getElementById('craft-fire-btn') as HTMLButtonElement;
    gameCanvas = document.getElementById('game-canvas')!;
    healthBar = document.getElementById('health-bar') as HTMLDivElement;
    healthText = document.getElementById('health-text')!;
    buildModeIndicator = document.getElementById('build-mode-indicator')!;
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
    const inventory = state.getState().inventory;
    let woodCount = 0;
    for (const slot in inventory) {
        if (inventory[slot] && inventory[slot].id === 'wood') {
            woodCount += inventory[slot].quantity;
        }
    }
    craftWallBtn.disabled = woodCount < 10;
    craftFireBtn.disabled = woodCount < 10;
}

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    inventorySlotsEl.innerHTML = ''; // Clear existing slots

    for (let i = 0; i < 10; i++) {
        const slotKey = `slot_${i}`;
        const item = inventory[slotKey];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot');

        if (item) {
            slotEl.textContent = `${item.id}: ${item.quantity}`;
        } else {
            slotEl.textContent = '-'; // Empty slot
        }
        inventorySlotsEl.appendChild(slotEl);
    }

    updateCraftingUI();
}

export function setBuildModeActive(isActive: boolean, buildItem: string | null): void {
    if (isActive && buildItem) {
        gameCanvas.classList.add('build-mode');
        buildModeIndicator.textContent = `Building: ${buildItem.replace('_', ' ')}`;
        buildModeIndicator.style.display = 'block';
    } else {
        gameCanvas.classList.remove('build-mode');
        buildModeIndicator.style.display = 'none';
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