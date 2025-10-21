import * as state from './state';
import { edibleDefs, itemDefinitions } from './definitions';

let playerIdEl: HTMLElement;
let cooldownBar: HTMLDivElement;
let cooldownText: HTMLElement;
let inventorySlotsEl: HTMLElement;
let craftWallBtn: HTMLButtonElement;
let craftFireBtn: HTMLButtonElement;
let craftRatMeatBtn: HTMLButtonElement;
let craftCrudeAxeBtn: HTMLButtonElement;
let gameCanvas: HTMLElement;
let healthBar: HTMLDivElement;
let healthText: HTMLElement;
let buildModeIndicator: HTMLElement;
let gearSlotsEl: HTMLElement;

export function initializeUI() {
    playerIdEl = document.getElementById('player-id')!;
    cooldownBar = document.getElementById('cooldown-bar') as HTMLDivElement;
    cooldownText = document.getElementById('cooldown-text')!;
    inventorySlotsEl = document.getElementById('inventory-slots')!;
    craftWallBtn = document.getElementById('craft-wall-btn') as HTMLButtonElement;
    craftFireBtn = document.getElementById('craft-fire-btn') as HTMLButtonElement;
    craftRatMeatBtn = document.getElementById('craft-rat-meat-btn') as HTMLButtonElement;
    craftCrudeAxeBtn = document.getElementById('craft-crude-axe-btn') as HTMLButtonElement;
    gameCanvas = document.getElementById('game-canvas')!;
    healthBar = document.getElementById('health-bar') as HTMLDivElement;
    healthText = document.getElementById('health-text')!;
    buildModeIndicator = document.getElementById('build-mode-indicator')!;
    gearSlotsEl = document.getElementById('gear-slots')!;
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
    let stoneCount = 0;
    let goopCount = 0;
    let ratMeatCount = 0;
    for (const slot in inventory) {
        if (inventory[slot] && inventory[slot].id === 'wood') {
            woodCount += inventory[slot].quantity;
        }
        if (inventory[slot] && inventory[slot].id === 'stone') {
            stoneCount += inventory[slot].quantity;
        }
        if (inventory[slot] && inventory[slot].id === 'goop') {
            goopCount += inventory[slot].quantity;
        }
        if (inventory[slot] && inventory[slot].id === 'rat_meat') {
            ratMeatCount += inventory[slot].quantity;
        }
    }
    craftWallBtn.disabled = woodCount < 10;
    craftFireBtn.disabled = woodCount < 10;
    craftRatMeatBtn.disabled = ratMeatCount < 1;
    craftCrudeAxeBtn.disabled = woodCount < 10 || stoneCount < 10 || goopCount < 5;
}

export function updateGearUI(): void {
    const gear = state.getState().gear;
    
    // Clear existing gear slots
    const slots = gearSlotsEl.querySelectorAll('.gear-slot');
    slots.forEach(slot => {
        const display = slot.querySelector('.gear-item-display') as HTMLElement;
        const unequipBtn = slot.querySelector('.unequip-button') as HTMLButtonElement;
        
        display.textContent = '-';
        unequipBtn.style.display = 'none';
        unequipBtn.dataset.slot = slot.id;
    });

    for (const slotId in gear) {
        const item = gear[slotId];
        const slotEl = document.getElementById(slotId);
        if (slotEl) {
            const display = slotEl.querySelector('.gear-item-display') as HTMLElement;
            const unequipBtn = slotEl.querySelector('.unequip-button') as HTMLButtonElement;
            if (item && item.id) {
                const itemDef = itemDefinitions[item.id];
                let displayText = item.id;
                if (itemDef && itemDef.equippable && itemDef.equippable.damage) {
                    displayText += ` (+${itemDef.equippable.damage} dmg)`;
                }
                display.textContent = displayText;
                unequipBtn.style.display = 'inline-block';
            }
        }
    }
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
            const edible = edibleDefs[item.id];
            if (edible) {
                const eatButton = document.createElement('button');
                eatButton.textContent = `Eat (${edible.healAmount}hp)`;
                eatButton.classList.add('eat-button');
                eatButton.dataset.item = item.id;
                slotEl.appendChild(eatButton);
            }

            const itemDef = itemDefinitions[item.id];
            if (itemDef && itemDef.equippable) {
                let buttonText = 'Equip';
                if (itemDef.equippable.damage) {
                    buttonText += ` (+${itemDef.equippable.damage} dmg)`;
                }
                const equipButton = document.createElement('button');
                equipButton.textContent = buttonText;
                equipButton.classList.add('equip-button');
                equipButton.dataset.slot = slotKey;
                slotEl.appendChild(equipButton);
            }
        } else {
            slotEl.textContent = '-'; // Empty slot
        }
        inventorySlotsEl.appendChild(slotEl);
    }

    updateCraftingUI();
    updateGearUI();
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