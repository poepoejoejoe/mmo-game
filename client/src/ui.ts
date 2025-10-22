import * as state from './state';
import { edibleDefs, itemDefinitions } from './definitions';
import { send } from './network';

// Top Bar
let registrationContainer: HTMLElement;
let nameInput: HTMLInputElement;
let registerButton: HTMLButtonElement;
let welcomeMessageEl: HTMLElement;
let helpButton: HTMLButtonElement;
let helpModalClose: HTMLElement;

// Main Content
let gameCanvas: HTMLElement;

// Bottom Bar
let playerCoordsEl: HTMLElement;
let healthText: HTMLElement;
let playerNameDisplayEl: HTMLElement;
export let inventoryView: HTMLElement;
export let craftingView: HTMLElement;
export let gearView: HTMLElement;
let infoPanel: HTMLElement;
let inventoryButton: HTMLButtonElement;
let craftingButton: HTMLButtonElement;
let gearButton: HTMLButtonElement;
let chatMessagesEl: HTMLElement;
let chatButton: HTMLButtonElement;
let chatContainer: HTMLElement;

let currentPanel: 'inventory' | 'crafting' | 'gear' | null = 'inventory';
let isChatOpen = true;

export function initializeUI() {
    // Top Bar
    registrationContainer = document.getElementById('registration-container')!;
    nameInput = document.getElementById('name-input') as HTMLInputElement;
    registerButton = document.getElementById('register-button') as HTMLButtonElement;
    welcomeMessageEl = document.getElementById('welcome-message')!;
    helpButton = document.getElementById('help-button') as HTMLButtonElement;
    helpModalClose = document.getElementById('help-modal-close') as HTMLElement;

    // Main Content
    gameCanvas = document.getElementById('game-canvas')!;

    // Bottom Bar
    playerCoordsEl = document.getElementById('player-coords')!;
    healthText = document.getElementById('health-text')!;
    playerNameDisplayEl = document.getElementById('player-name-display')!;
    inventoryView = document.getElementById('inventory-view')!;
    craftingView = document.getElementById('crafting-view')!;
    gearView = document.getElementById('gear-view')!;
    infoPanel = document.getElementById('info-panel')!;
    inventoryButton = document.getElementById('inventory-button') as HTMLButtonElement;
    craftingButton = document.getElementById('crafting-button') as HTMLButtonElement;
    gearButton = document.getElementById('gear-button') as HTMLButtonElement;
    chatMessagesEl = document.getElementById('chat-messages')!;
    chatButton = document.getElementById('chat-button') as HTMLButtonElement;
    chatContainer = document.getElementById('chat-container')!;

    registerButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            send({
                type: 'register',
                payload: { name: name }
            });
            registrationContainer.style.display = 'none';
        }
    });

    inventoryButton.addEventListener('click', () => toggleInfoPanel('inventory'));
    craftingButton.addEventListener('click', () => toggleInfoPanel('crafting'));
    gearButton.addEventListener('click', () => toggleInfoPanel('gear'));
    helpButton.addEventListener('click', () => toggleModal('help-modal', true));
    helpModalClose.addEventListener('click', () => toggleModal('help-modal', false));
    chatButton.addEventListener('click', toggleChat);
    
    // Set initial state on load
    updateButtonSelection();
    toggleChat(); // to set initial state
    toggleChat(); // toggle back to open, but apply style
}

export function promptForRegistration() {
    if (!localStorage.getItem('secretKey')) {
        registrationContainer.style.display = 'flex';
        welcomeMessageEl.style.display = 'none';
    }
}

function toggleChat() {
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
        chatContainer.style.display = 'flex';
    } else {
        chatContainer.style.display = 'none';
    }
}

function toggleInfoPanel(panelType: 'inventory' | 'crafting' | 'gear') {
    if (panelType === currentPanel) {
        currentPanel = null;
    } else {
        currentPanel = panelType;
    }
    updateButtonSelection();
    updateInventoryUI(); // Re-render to show/hide views
}

function updateButtonSelection() {
    inventoryButton.classList.remove('selected');
    craftingButton.classList.remove('selected');
    gearButton.classList.remove('selected');
    inventoryView.style.display = 'none';
    craftingView.style.display = 'none';
    gearView.style.display = 'none';
    infoPanel.style.display = 'none';

    if (currentPanel === 'inventory') {
        inventoryButton.classList.add('selected');
        inventoryView.style.display = 'flex';
        infoPanel.style.display = 'flex';
    } else if (currentPanel === 'crafting') {
        craftingButton.classList.add('selected');
        craftingView.style.display = 'flex';
        infoPanel.style.display = 'flex';
    } else if (currentPanel === 'gear') {
        gearButton.classList.add('selected');
        gearView.style.display = 'flex';
        infoPanel.style.display = 'flex';
    }
}

function toggleModal(modalId: string, show: boolean) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.add('active');
        } else {
            modal.classList.remove('active');
        }
    }
}


export function addChatMessage(playerId: string, message: string) {
    const messageEl = document.createElement('div');
    const s = state.getState();
    const entity = s.entities[playerId];

    let displayName = playerId;
    if (entity && entity.name) {
        displayName = entity.name;
    } else {
        // guest-xxxx
        displayName = playerId.substring(0, 12);
    }
    
    messageEl.innerHTML = `<strong>${displayName}:</strong> ${message}`;
    chatMessagesEl.prepend(messageEl);
}

export function startCooldown(duration: number): void {
    // This UI element was removed in the new design.
    // We can re-add it later if needed.
    console.log(`Action cooldown started for ${duration}ms`);
}

export function updateCraftingUI(): void {
    const inventory = state.getState().inventory;
    craftingView.innerHTML = ''; // Clear existing recipes

    // Define a type for recipe requirements
    type RecipeRequirements = { [key: string]: number };

    // Example recipes (can be moved to definitions.ts)
    const recipes = [
        { id: 'craft-wall-btn', text: 'Wall (10 Wood)', req: { wood: 10 } as RecipeRequirements, item: 'wooden_wall' },
        { id: 'craft-fire-btn', text: 'Fire (10 Wood)', req: { wood: 10 } as RecipeRequirements, item: 'fire' },
        { id: 'cook-rat-meat-btn', text: 'Cook Meat (1 Rat Meat)', req: { rat_meat: 1 } as RecipeRequirements, item: 'cooked_rat_meat' },
        { id: 'craft-axe-btn', text: 'Axe (10W, 10S, 5G)', req: { wood: 10, stone: 10, goop: 5 } as RecipeRequirements, item: 'crude_axe' },
    ];

    const counts: { [key: string]: number } = { wood: 0, stone: 0, goop: 0, rat_meat: 0 };
    for (const slot in inventory) {
        if (inventory[slot]) {
            counts[inventory[slot].id] = (counts[inventory[slot].id] || 0) + inventory[slot].quantity;
        }
    }

    recipes.forEach(recipe => {
        const canCraft = Object.keys(recipe.req).every(itemId => counts[itemId] >= recipe.req[itemId]);
        const recipeEl = document.createElement('div');
        recipeEl.classList.add('crafting-recipe');
        
        const button = document.createElement('button');
        button.id = recipe.id;
        button.textContent = recipe.text;
        button.disabled = !canCraft;
        button.dataset.item = recipe.item; // Store the item to be crafted
        
        recipeEl.appendChild(button);
        craftingView.appendChild(recipeEl);
    });
}

export function updateGearUI(): void {
    const gear = state.getState().gear;
    gearView.innerHTML = ''; // Clear existing slots

    for (const slot in gear) {
        const item = gear[slot];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot'); // Reuse styles

        if (item) {
            const nameEl = document.createElement('div');
            nameEl.classList.add('item-name');
            nameEl.textContent = item.id;
            slotEl.appendChild(nameEl);

            const unequipButton = document.createElement('button');
            unequipButton.textContent = 'Unequip';
            unequipButton.classList.add('unequip-button');
            unequipButton.dataset.slot = slot;
            slotEl.appendChild(unequipButton);
        } else {
            const nameEl = document.createElement('div');
            nameEl.classList.add('item-name');
            nameEl.textContent = slot; // e.g. "hand", "head"
            slotEl.appendChild(nameEl);
        }
        gearView.appendChild(slotEl);
    }
}

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    inventoryView.innerHTML = ''; // Clear existing slots

    for (let i = 0; i < 10; i++) {
        const slotKey = `slot_${i}`;
        const item = inventory[slotKey];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot');

        if (item) {
            const nameEl = document.createElement('div');
            nameEl.classList.add('item-name');
            nameEl.textContent = item.id;
            slotEl.appendChild(nameEl);

            const quantityEl = document.createElement('div');
            quantityEl.classList.add('item-quantity');
            quantityEl.textContent = String(item.quantity);
            slotEl.appendChild(quantityEl);
            
            const edible = edibleDefs[item.id];
            if (edible) {
                const eatButton = document.createElement('button');
                eatButton.textContent = `Eat`;
                eatButton.classList.add('eat-button');
                eatButton.dataset.item = item.id;
                slotEl.appendChild(eatButton);
            }

            const itemDef = itemDefinitions[item.id];
            if (itemDef && itemDef.equippable) {
                const equipButton = document.createElement('button');
                equipButton.textContent = 'Equip';
                equipButton.classList.add('equip-button');
                equipButton.dataset.slot = slotKey;
                slotEl.appendChild(equipButton);
            }
        } else {
            slotEl.innerHTML = `&nbsp;`; // Empty slot
        }
        inventoryView.appendChild(slotEl);
    }

    updateCraftingUI();
    updateGearUI();
}

export function setBuildModeActive(isActive: boolean, buildItem: string | null): void {
    if (isActive && buildItem) {
        gameCanvas.classList.add('build-mode');
    } else {
        gameCanvas.classList.remove('build-mode');
    }
}

export function updatePlayerIdDisplay() {
    // This is now handled by updatePlayerNameDisplay
}

export function updatePlayerNameDisplay(name: string) {
    if (name) {
        welcomeMessageEl.textContent = `Welcome, ${name}!`;
        playerNameDisplayEl.textContent = name;
        registrationContainer.style.display = 'none';
        welcomeMessageEl.style.display = 'block';
    } else {
        welcomeMessageEl.style.display = 'none';
    }
}

export function updatePlayerHealth(health: number, maxHealth: number) {
    healthText.textContent = `${health} / ${maxHealth}`;
}

export function updatePlayerCoords(x: number, y: number) {
    playerCoordsEl.textContent = `(${x}, ${y})`;
}