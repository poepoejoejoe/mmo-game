import * as state from './state';
import { edibleDefs, itemDefinitions } from './definitions';
import { send } from './network';

const skillIcons = {
    woodcutting: '🌳',
    mining: '⛏️',
    smithing: '🔥',
    cooking: '🍳',
    construction: '🏠',
    attack: '⚔️',
    defense: '🛡️',
};

function createIconElement(itemDef: any): HTMLElement {
    const iconEl = document.createElement('div');
    iconEl.classList.add('item-icon');

    if (itemDef.asset) {
        const img = document.createElement('img');
        img.src = itemDef.asset;
        img.alt = itemDef.text || 'item icon';
        iconEl.appendChild(img);
    } else {
        iconEl.textContent = itemDef.icon || itemDef.character;
    }

    return iconEl;
}

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
let healthBar: HTMLElement;
let healthBarText: HTMLElement;
let playerNameDisplayEl: HTMLElement;
export let inventoryView: HTMLElement;
export let craftingView: HTMLElement;
export let gearView: HTMLElement;
export let questView: HTMLElement;
export let experienceView: HTMLElement;
let inventoryButton: HTMLButtonElement;
let craftingButton: HTMLButtonElement;
let gearButton: HTMLButtonElement;
let questButton: HTMLButtonElement;
let experienceButton: HTMLButtonElement;
let echoButton: HTMLButtonElement;
let chatMessagesEl: HTMLElement;
let chatButton: HTMLButtonElement;
let chatContainer: HTMLElement;

// --- NEW: Dialog UI Elements ---
let dialogModal: HTMLElement;
let dialogNpcName: HTMLElement;
let dialogText: HTMLElement;
let dialogOptions: HTMLElement;
let dialogCloseButton: HTMLElement;
let dialogOverlay: HTMLElement;


const openPanels = new Set<'inventory' | 'crafting' | 'gear' | 'quest' | 'experience'>();
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
    healthBar = document.getElementById('health-bar')!;
    healthBarText = document.getElementById('health-bar-text')!;
    playerNameDisplayEl = document.getElementById('player-name-display')!;
    inventoryView = document.getElementById('inventory-view')!;
    craftingView = document.getElementById('crafting-view')!;
    gearView = document.getElementById('gear-view')!;
    questView = document.getElementById('quest-view')!;
    experienceView = document.getElementById('experience-view')!;
    inventoryButton = document.getElementById('inventory-button') as HTMLButtonElement;
    craftingButton = document.getElementById('crafting-button') as HTMLButtonElement;
    gearButton = document.getElementById('gear-button') as HTMLButtonElement;
    questButton = document.getElementById('quest-button') as HTMLButtonElement;
    experienceButton = document.getElementById('experience-button') as HTMLButtonElement;
    echoButton = document.getElementById('echo-button') as HTMLButtonElement;
    chatMessagesEl = document.getElementById('chat-messages')!;
    chatButton = document.getElementById('chat-button') as HTMLButtonElement;
    chatContainer = document.getElementById('chat-container')!;

    // Dialog
    dialogModal = document.getElementById('dialog-modal')!;
    dialogNpcName = document.getElementById('dialog-npc-name')!;
    dialogText = document.getElementById('dialog-text')!;
    dialogOptions = document.getElementById('dialog-options')!;
    dialogCloseButton = document.getElementById('dialog-close-button')!;
    dialogOverlay = document.getElementById('dialog-overlay')!;

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
    questButton.addEventListener('click', () => toggleInfoPanel('quest'));
    experienceButton.addEventListener('click', () => toggleInfoPanel('experience'));
    echoButton.addEventListener('click', () => {
        send({ type: 'toggle_echo', payload: {} });
    });
    helpButton.addEventListener('click', () => toggleModal('help-modal', true));
    helpModalClose.addEventListener('click', () => toggleModal('help-modal', false));
    dialogCloseButton.addEventListener('click', hideDialog);
    dialogOverlay.addEventListener('click', hideDialog);
    chatButton.addEventListener('click', toggleChat);
    
    // Set initial state on load
    updateButtonAndPanelSelection();
    toggleChat(); // to set initial state
    toggleChat(); // toggle back to open, but apply style

    inventoryButton.innerHTML = `<img src="assets/inventory-icon.png" alt="Inventory">`;
    craftingButton.innerHTML = `<img src="assets/crafting-icon.png" alt="Crafting">`;
    gearButton.innerHTML = `<img src="assets/gear-icon.png" alt="Gear">`;
    questButton.innerHTML = `<img src="assets/quest-icon.png" alt="Quests">`;
    chatButton.innerHTML = `<img src="assets/chat-icon.png" alt="Chat">`;
    echoButton.innerHTML = `<img src="assets/fire-icon.png" alt="Echo">`; // Placeholder icon
}

export function showCraftSuccess(itemId: string) {
    const itemDef = itemDefinitions[itemId] || itemDefinitions.default;
    if (!itemDef || !itemDef.asset) return;

    const container = document.getElementById('effect-container');
    if (!container) return;

    const icon = document.createElement('img');
    icon.src = itemDef.asset;
    icon.className = 'floating-icon';

    const rect = inventoryButton.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    icon.style.left = `${rect.left - containerRect.left + (rect.width / 2)}px`;
    icon.style.top = `${rect.top - containerRect.top}px`;

    container.appendChild(icon);

    icon.addEventListener('animationend', () => {
        icon.remove();
    });
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

function toggleInfoPanel(panelType: 'inventory' | 'crafting' | 'gear' | 'quest' | 'experience') {
    if (openPanels.has(panelType)) {
        openPanels.delete(panelType);
    } else {
        openPanels.add(panelType);

        const panelMap = {
            inventory: inventoryView,
            crafting: craftingView,
            gear: gearView,
            quest: questView,
            experience: experienceView,
        };

        const panelElement = panelMap[panelType];
        if (panelElement && panelElement.parentElement) {
            panelElement.parentElement.prepend(panelElement);
        }
    }
    updateButtonAndPanelSelection();
    updateInventoryUI(); // Re-render to show/hide views
}

function updateButtonAndPanelSelection() {
    // Buttons
    inventoryButton.classList.toggle('selected', openPanels.has('inventory'));
    craftingButton.classList.toggle('selected', openPanels.has('crafting'));
    gearButton.classList.toggle('selected', openPanels.has('gear'));
    questButton.classList.toggle('selected', openPanels.has('quest'));
    experienceButton.classList.toggle('selected', openPanels.has('experience'));

    // Views
    inventoryView.style.display = openPanels.has('inventory') ? 'flex' : 'none';
    craftingView.style.display = openPanels.has('crafting') ? 'flex' : 'none';
    gearView.style.display = openPanels.has('gear') ? 'flex' : 'none';
    questView.style.display = openPanels.has('quest') ? 'flex' : 'none';
    experienceView.style.display = openPanels.has('experience') ? 'flex' : 'none';
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

export function showDialog(npcName: string, text: string, options: { text: string, action: string }[], position: {x: number, y: number} | null) {
    dialogNpcName.textContent = npcName;
    dialogText.innerHTML = `<p>${text.replace(/\n/g, '</p><p>')}</p>`; // Support newlines
    dialogOptions.innerHTML = '';

    options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option.text;
        button.dataset.action = option.action;
        button.addEventListener('click', () => {
            if (option.action !== 'close_dialog') {
                send({
                    type: 'dialog_action',
                    payload: { action: option.action }
                });
            }
            hideDialog(); // Close dialog after choosing
        });
        dialogOptions.appendChild(button);
    });

    if (position) {
        dialogModal.style.left = `${position.x}px`;
        dialogModal.style.top = `${position.y}px`;
        dialogModal.style.transform = 'translate(-50%, -110%)'; // Reset transform if it was changed
    } else {
        // Fallback to center if no position is given
        dialogModal.style.left = '50%';
        dialogModal.style.top = '50%';
        dialogModal.style.transform = 'translate(-50%, -50%)';
    }

    dialogOverlay.classList.add('active');
    toggleModal('dialog-modal', true);
}

export function hideDialog() {
    dialogOverlay.classList.remove('active');
    toggleModal('dialog-modal', false);
    state.setActiveNpcId(null);
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
    craftingView.innerHTML = '<h2>Crafting</h2>';

    // Define a type for recipe requirements
    type RecipeRequirements = { [key: string]: number };

    // Example recipes (can be moved to definitions.ts)
    const recipes = [
        { id: 'craft-wall-btn', text: 'Wall', req: { wood: 10 } as RecipeRequirements, item: 'wooden_wall' },
        { id: 'craft-fire-btn', text: 'Fire', req: { wood: 10 } as RecipeRequirements, item: 'fire' },
        { id: 'cook-rat-meat-btn', text: 'Cook Meat', req: { rat_meat: 1 } as RecipeRequirements, item: 'cooked_rat_meat' },
        { id: 'craft-axe-btn', text: 'Axe', req: { wood: 10, stone: 10, goop: 5 } as RecipeRequirements, item: 'crude_axe' },
    ];

    const counts: { [key: string]: number } = {};
    for (const slot in inventory) {
        if (inventory[slot]) {
            counts[inventory[slot].id] = (counts[inventory[slot].id] || 0) + inventory[slot].quantity;
        }
    }

    recipes.forEach(recipe => {
        const canCraft = Object.keys(recipe.req).every(itemId => counts[itemId] >= recipe.req[itemId]);

        const itemDef = itemDefinitions[recipe.item] || itemDefinitions['default'];
        
        const button = document.createElement('button');
        button.id = recipe.id;
        button.classList.add('crafting-recipe');
        button.disabled = !canCraft;
        button.dataset.item = recipe.item; // Store the item to be crafted

        const iconEl = createIconElement(itemDef);
        button.appendChild(iconEl);

        button.addEventListener('mouseenter', () => showCraftingTooltip(button, recipe));
        button.addEventListener('mouseleave', hideCraftingTooltip);
        
        craftingView.appendChild(button);
    });
}

function showCraftingTooltip(button: HTMLButtonElement, recipe: any) {
    hideCraftingTooltip(); // Remove any existing tooltip
    hideInventoryTooltip();
    hideGearTooltip();

    const tooltip = document.createElement('div');
    tooltip.id = 'crafting-tooltip';
    tooltip.classList.add('crafting-tooltip');

    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;

    const craftedItemDef = itemDefinitions[recipe.item] || itemDefinitions['default'];

    let content = `<div class="tooltip-title">Craft: ${craftedItemDef.text || recipe.item}</div>`;
    content += '<hr>';

    let hasCosts = Object.keys(recipe.req).length > 0;
    if (hasCosts) {
        content += '<h4>Costs:</h4>';
        for (const itemId in recipe.req) {
            const itemDef = itemDefinitions[itemId] || itemDefinitions['default'];
            const requiredAmount = recipe.req[itemId];
            content += `<div class="tooltip-item">
                ${createIconElement(itemDef).outerHTML}
                <span>${requiredAmount}x ${itemDef.text || itemId}</span>
            </div>`;
        }
    }

    if (recipe.item === 'cooked_rat_meat') {
        if (hasCosts) {
            content += '<hr>';
        }
        content += `<p class="special-req">Requires adjacent fire</p>`;
    }

    tooltip.innerHTML = content;
    document.body.appendChild(tooltip);
}

function hideCraftingTooltip() {
    const tooltip = document.getElementById('crafting-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function showInventoryTooltip(slotEl: HTMLElement, item: any) {
    hideCraftingTooltip();
    hideInventoryTooltip(); // Remove any existing tooltip
    hideGearTooltip();

    const tooltip = document.createElement('div');
    tooltip.id = 'inventory-tooltip';
    tooltip.classList.add('inventory-tooltip'); // We'll need new styles for this

    const rect = slotEl.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;

    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
    let content = `<div class="tooltip-title">${itemDef.text || item.id}</div>`;
    
    const edible = edibleDefs[item.id];
    const equippable = itemDef.equippable;

    if (edible || equippable) {
        content += '<hr>';
    }

    if (equippable) {
        content += `<p class="tooltip-action">Equip ${itemDef.text || item.id}</p>`;
        if (equippable.damage) {
            content += `<p class="tooltip-stat">+${equippable.damage} Damage</p>`;
        }
    }
    
    if (edible) {
        content += `<p class="tooltip-action">Eat ${itemDef.text || item.id}</p>`;
        content += `<p class="tooltip-stat">+${edible.healAmount} Health</p>`;
    }

    tooltip.innerHTML = content;
    document.body.appendChild(tooltip);
}

function hideInventoryTooltip() {
    const tooltip = document.getElementById('inventory-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function showGearTooltip(slotEl: HTMLElement, item: any) {
    hideCraftingTooltip();
    hideInventoryTooltip();
    hideGearTooltip();

    const tooltip = document.createElement('div');
    tooltip.id = 'gear-tooltip';
    tooltip.classList.add('inventory-tooltip'); // Reuse styles

    const rect = slotEl.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;

    const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
    let content = `<div class="tooltip-title">${itemDef.text || item.id}</div>`;
    content += '<hr>';
    content += `<p class="tooltip-action">Unequip ${itemDef.text || item.id}</p>`;

    if (itemDef.equippable?.damage) {
        content += `<p class="tooltip-stat">+${itemDef.equippable.damage} Damage</p>`;
    }
    
    tooltip.innerHTML = content;
    document.body.appendChild(tooltip);
}

function hideGearTooltip() {
    const tooltip = document.getElementById('gear-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

export function updateQuestUI(): void {
    const quests = state.getState().quests;
    const allQuests = Object.values(quests);

    if (allQuests.length === 0) {
        questView.innerHTML = '<h2>Quests</h2><p>No active quests.</p>';
        return;
    }

    let content = '<h2>Quests</h2>';
    for (const quest of allQuests) {
        content += `<div class="quest">`;
        if (quest.is_complete) {
            content += `<h3>${quest.title} <span class="quest-complete">(Completed)</span></h3>`;
        } else {
            content += `<h3>${quest.title}</h3>`;
        }
        content += `<ul class="quest-objectives">`;
        quest.objectives.forEach(obj => {
            content += `<li class="${obj.completed ? 'completed' : ''}">${obj.description}</li>`;
        });
        content += `</ul>`;
        content += `</div>`;
    }
    questView.innerHTML = content;
}

export function updateGearUI(): void {
    const gear = state.getState().gear;
    gearView.innerHTML = '<h2>Gear</h2>';

    let hasSlots = false;
    for (const slot in gear) {
        hasSlots = true;
        const item = gear[slot];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot'); // Reuse styles

        if (item) {
            const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
            const iconEl = createIconElement(itemDef);
            slotEl.appendChild(iconEl);

            slotEl.classList.add('unequippable');
            slotEl.dataset.slot = slot;

            slotEl.addEventListener('mouseenter', () => showGearTooltip(slotEl, item));
            slotEl.addEventListener('mouseleave', hideGearTooltip);
        } else {
            const nameEl = document.createElement('div');
            nameEl.classList.add('item-name');
            nameEl.textContent = slot; // e.g. "hand", "head"
            slotEl.appendChild(nameEl);
        }
        gearView.appendChild(slotEl);
    }

    if (!hasSlots) {
        const p = document.createElement('p');
        p.textContent = 'No gear slots available.';
        gearView.appendChild(p);
    }
}

export function updateInventoryUI(): void {
    const inventory = state.getState().inventory;
    inventoryView.innerHTML = '<h2>Inventory</h2>';

    for (let i = 0; i < 10; i++) {
        const slotKey = `slot_${i}`;
        const item = inventory[slotKey];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot');

        if (item) {
            const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
            const iconEl = createIconElement(itemDef);
            slotEl.appendChild(iconEl);

            const quantityEl = document.createElement('div');
            quantityEl.classList.add('item-quantity');
            quantityEl.textContent = String(item.quantity);
            slotEl.appendChild(quantityEl);
            
            const edible = edibleDefs[item.id];
            if (edible) {
                slotEl.classList.add('edible');
                slotEl.dataset.item = item.id;
            }

            const itemDefForEquip = itemDefinitions[item.id];
            if (itemDefForEquip && itemDefForEquip.equippable) {
                slotEl.classList.add('equippable');
                slotEl.dataset.slot = slotKey;
            }
            
            slotEl.addEventListener('mouseenter', () => showInventoryTooltip(slotEl, item));
            slotEl.addEventListener('mouseleave', hideInventoryTooltip);
        } else {
            slotEl.innerHTML = `&nbsp;`; // Empty slot
        }
        inventoryView.appendChild(slotEl);
    }

    updateCraftingUI();
    updateGearUI();
    updateQuestUI();
    updateExperienceUI();
    updateEchoUI();
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
    const healthPercentage = maxHealth > 0 ? (health / maxHealth) * 100 : 0;

    healthBar.style.width = `${healthPercentage}%`;

    // Simple color transition from green to red
    const green = [76, 175, 80];
    const red = [211, 47, 47];

    const r = red[0] + (green[0] - red[0]) * (healthPercentage / 100);
    const g = red[1] + (green[1] - red[1]) * (healthPercentage / 100);
    const b = red[2] + (green[2] - red[2]) * (healthPercentage / 100);

    healthBar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

    healthBarText.textContent = `${health} / ${maxHealth}`;
}

export function updateEchoUI(): void {
    const me = state.getMyEntity();
    const isUnlocked = state.getState().echoUnlocked;
    if (!me || !isUnlocked) {
        echoButton.style.display = 'none';
        return;
    }

    const resonance = state.getState().resonance || 0;
    const isEcho = me.isEcho || false;

    if (isEcho) {
        echoButton.classList.add('selected');
        const minutes = Math.floor(resonance / 60);
        const seconds = resonance % 60;
        echoButton.title = `Reclaim Control (${minutes}m ${seconds}s remaining)`;
    } else {
        echoButton.classList.remove('selected');
        const minutes = Math.floor(resonance / 60);
        const seconds = resonance % 60;
        echoButton.title = `Activate Echo (${minutes}m ${seconds}s available)`;
    }
}

export function updateExperienceUI(): void {
    const experience = state.getState().experience;
    experienceView.innerHTML = '<h2>Experience</h2>';

    if (!experience) {
        return;
    }

    for (const skill in experience) {
        const xp = experience[skill];
        const skillEl = document.createElement('div');
        skillEl.classList.add('skill-display');

        const icon = skillIcons[skill as keyof typeof skillIcons] || '❓';
        const name = skill.charAt(0).toUpperCase() + skill.slice(1);
        const level = Math.floor(xp / 100); // Example: 100 xp per level
        const xpForNextLevel = (level + 1) * 100;
        const currentLevelXp = xp - level * 100;
        const xpProgress = (currentLevelXp / 100) * 100;


        skillEl.innerHTML = `
            <div class="skill-icon">${icon}</div>
            <div class="skill-info">
                <div class="skill-name">${name} (Level ${level})</div>
                <div class="skill-bar-container">
                    <div class="skill-bar" style="width: ${xpProgress}%"></div>
                </div>
                <div class="skill-xp-text">${Math.floor(xp)} / ${xpForNextLevel} XP</div>
            </div>
        `;

        experienceView.appendChild(skillEl);
    }
}

export function updatePlayerCoords(x: number, y: number) {
    playerCoordsEl.textContent = `(${x}, ${y})`;
}