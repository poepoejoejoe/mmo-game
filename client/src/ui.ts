import * as state from './state';
import { edibleDefs, itemDefinitions, recipeDefs, gearSlots } from './definitions';
import { send, sendLearnRecipe, sendDepositItem, sendWithdrawItem } from './network';

const skillIcons: Record<string, string> = {
    woodcutting: 'assets/woodcutting-icon.png',
    mining: 'assets/mining-icon.png',
    smithing: 'assets/smithing-icon.png',
    cooking: 'assets/cooking-icon.png',
    construction: 'assets/construction-icon.png',
    attack: 'assets/attack-icon.png',
    defense: 'assets/defense-icon.png',
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
export let inventoryView: HTMLElement | null;
export let craftingView: HTMLElement | null;
export let gearView: HTMLElement | null;
export let questView: HTMLElement | null;
export let experienceView: HTMLElement | null;
export let runesView: HTMLElement | null;
export let bankView: HTMLElement | null;
// Chat is now handled by React - no longer needed here

// Bank
let bankButton: HTMLButtonElement; // This will be created dynamically

// --- Dialog UI Elements ---
// Dialog is now handled by React - no longer needed here

// Bank
let isBankUIInitialized = false;


const openPanels = new Set<'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank'>();
// Chat state is now handled by React - no longer needed here

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
    inventoryView = document.getElementById('inventory-view'); // May be null until React renders
    craftingView = document.getElementById('crafting-view'); // May be null until React renders
    gearView = document.getElementById('gear-view'); // May be null until React renders
    questView = document.getElementById('quest-view');
    experienceView = document.getElementById('experience-view');
    runesView = document.getElementById('runes-view');
    // Chat is now handled by React - no initialization needed

    // Dialog is now handled by React - no initialization needed

    // Bank is now handled by React - no initialization needed
    bankView = document.getElementById('bank-view');

    // Create and add the bank button dynamically
    bankButton = document.createElement('button');
    bankButton.id = 'bank-button';
    bankButton.className = 'action-button';
    bankButton.innerHTML = `<img src="assets/inventory-icon.png" alt="Bank">`; // Placeholder icon
    bankButton.addEventListener('click', () => {
        // Use React toggle function if available, otherwise fall back to legacy
        const togglePanelFn = (window as any).togglePanel;
        if (togglePanelFn) {
            togglePanelFn('bank');
        } else {
            toggleInfoPanel('bank');
        }
    });
    document.getElementById('main-action-bar')?.appendChild(bankButton);


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

    helpButton.addEventListener('click', () => toggleModal('help-modal', true));
    helpModalClose.addEventListener('click', () => toggleModal('help-modal', false));
    // Dialog event listeners are now handled by React Dialog component
    // Chat event listeners are now handled by React Chat component
    
    // Set initial state on load
    updateButtonAndPanelSelection();

    const infoPanelsContainer = document.querySelector('.info-panels');
    infoPanelsContainer?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('close-button')) {
            const panelId = target.dataset.panelId;
            if (panelId) {
                toggleInfoPanel(panelId as 'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank');
            }
        }
    });

    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const slot = target.closest('.inventory-slot') as HTMLElement | null;

        if (slot) {
            const isBankOpen = bankView && bankView.style.display === 'flex';
            const isInventorySlot = inventoryView && inventoryView.contains(slot);

            if (isBankOpen && isInventorySlot) {
                // Already handled by the more specific listener in initializeBankUI
            } else if (slot.classList.contains('equippable')) {
                send({ type: 'equip', payload: { inventorySlot: slot.dataset.slot } });
            } else if (slot.classList.contains('edible')) {
                send({ type: 'eat', payload: { item: slot.dataset.item } });
            } else if (slot.classList.contains('learnable')) {
                sendLearnRecipe(slot.dataset.slot!);
            } else if (slot.classList.contains('unequippable')) {
                send({ type: 'unequip', payload: { gearSlot: slot.dataset.slot } });
            }
        }

        const craftButton = target.closest('.crafting-recipe') as HTMLElement | null;
        if (craftButton) {
            send({ type: 'craft', payload: { item: craftButton.dataset.item } });
        }
    });
}

export function setBuildModeActive(isActive: boolean, buildItem: string | null): void {
    if (isActive && buildItem) {
        gameCanvas.classList.add('build-mode');
    } else {
        gameCanvas.classList.remove('build-mode');
    }
}

function createPanelHeader(title: string, panelId: 'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank'): HTMLElement {
    const header = document.createElement('div');
    header.className = 'panel-header';

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const closeButton = document.createElement('span');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => toggleInfoPanel(panelId));
    header.appendChild(closeButton);

    return header;
}

function initializeBankUI() {
    if (isBankUIInitialized) return;

    const bankContextMenu = document.getElementById('bank-context-menu')!;
    const quantityModal = document.getElementById('quantity-modal')!;
    const quantityInput = document.getElementById('quantity-input') as HTMLInputElement;
    const quantitySubmit = document.getElementById('quantity-submit')!;
    
    let currentContext = { type: '', slot: '' };

    function showQuantityModal(type: 'deposit' | 'withdraw', slot: string) {
        currentContext = { type, slot };
        quantityModal.classList.add('active');
        quantityInput.value = '1';
        quantityInput.focus();
    }

    function hideQuantityModal() {
        quantityModal.classList.remove('active');
    }

    quantitySubmit.addEventListener('click', () => {
        const quantity = parseInt(quantityInput.value, 10);
        if (isNaN(quantity) || quantity <= 0) return;

        if (currentContext.type === 'deposit') {
            sendDepositItem(currentContext.slot, quantity);
        } else if (currentContext.type === 'withdraw') {
            sendWithdrawItem(currentContext.slot, quantity);
        }
        hideQuantityModal();
    });

    document.addEventListener('click', () => {
        if (bankContextMenu) {
            bankContextMenu.style.display = 'none';
        }
    });

    if (bankView) {
        bankView.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = e.target as HTMLElement;
            const slot = target.closest('.inventory-slot');
            if (slot) {
                const slotKey = (slot as HTMLElement).dataset.slot!;
                const item = state.getState().bank[slotKey];
                if (item) {
                    let menuHTML = '';
                    [1, 5, 10].forEach(q => {
                        if (item.quantity >= q) {
                             menuHTML += `<button data-action="withdraw" data-slot="${slotKey}" data-quantity="${q}">Withdraw ${q}</button>`;
                        }
                    });
                    menuHTML += `<button data-action="withdraw" data-slot="${slotKey}" data-quantity="${item.quantity}">Withdraw All</button>`;
                    menuHTML += `<button data-action="withdraw" data-slot="${slotKey}">Withdraw X</button>`;
                    
                    bankContextMenu.innerHTML = menuHTML;
                    bankContextMenu.style.left = `${e.clientX}px`;
                    bankContextMenu.style.top = `${e.clientY}px`;
                    bankContextMenu.style.display = 'block';
                }
            }
        });
    }

    if (inventoryView) {
        inventoryView.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (bankView && bankView.style.display !== 'flex') return;
        const target = e.target as HTMLElement;
        const slot = target.closest('.inventory-slot');
        if (slot) {
            const slotKey = (slot as HTMLElement).dataset.slot!;
            const item = state.getState().inventory[slotKey];
            if (item) {
                 let menuHTML = '';
                [1, 5, 10].forEach(q => {
                    if (item.quantity >= q) {
                         menuHTML += `<button data-action="deposit" data-slot="${slotKey}" data-quantity="${q}">Deposit ${q}</button>`;
                    }
                });
                menuHTML += `<button data-action="deposit" data-slot="${slotKey}" data-quantity="${item.quantity}">Deposit All</button>`;
                menuHTML += `<button data-action="deposit" data-slot="${slotKey}">Deposit X</button>`;
                
                bankContextMenu.innerHTML = menuHTML;
                bankContextMenu.style.left = `${e.clientX}px`;
                bankContextMenu.style.top = `${e.clientY}px`;
                bankContextMenu.style.display = 'block';
            }
        }
    });
    }

    bankContextMenu.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        const slot = target.dataset.slot;
        const quantityStr = target.dataset.quantity;

        if (action && slot) {
            if (quantityStr) {
                const quantity = parseInt(quantityStr, 10);
                if (action === 'deposit') {
                    sendDepositItem(slot, quantity);
                } else if (action === 'withdraw') {
                    sendWithdrawItem(slot, quantity);
                }
            } else {
                // This is the 'X' option
                showQuantityModal(action as 'deposit' | 'withdraw', slot);
            }
        }
        bankContextMenu.style.display = 'none';
    });

    const handleLeftClick = (e: MouseEvent, panel: 'inventory' | 'bank') => {
        const target = e.target as HTMLElement;
        const slotEl = target.closest('.inventory-slot');
        if (slotEl) {
            const slotKey = (slotEl as HTMLElement).dataset.slot!;
            if (panel === 'inventory') {
                sendDepositItem(slotKey, 1);
            } else {
                sendWithdrawItem(slotKey, 1);
            }
        }
    };

    if (inventoryView) {
        inventoryView.addEventListener('click', (e) => {
            if (openPanels.has('bank')) {
                handleLeftClick(e, 'inventory');
            }
        });
    }

    if (bankView) {
        bankView.addEventListener('click', (e) => handleLeftClick(e, 'bank'));
    }

    isBankUIInitialized = true;
}

export function openBankWindow() {
    initializeBankUI();
    const togglePanelFn = (window as any).togglePanel;
    if (togglePanelFn) {
        // Use React toggle function - it will check if inventory is already open
        togglePanelFn('bank');
        // Also ensure inventory is open (React will handle the state check)
        togglePanelFn('inventory');
    } else {
        // Fall back to legacy
        if (!openPanels.has('inventory')) {
            toggleInfoPanel('inventory');
        }
        toggleInfoPanel('bank');
    }
}

export function closeBankWindow() {
    const closeBankPanelFn = (window as any).closeBankPanel;
    if (closeBankPanelFn) {
        closeBankPanelFn();
    } else {
        // Fall back to legacy
        const togglePanelFn = (window as any).togglePanel;
        if (togglePanelFn && openPanels.has('bank')) {
            togglePanelFn('bank');
        } else if (openPanels.has('bank')) {
            toggleInfoPanel('bank');
        }
    }
}

export function updateBankUI() {
    // This function is now obsolete - bank is handled by React
    // Keeping it for compatibility but it does nothing if bankView is null
    if (!bankView) return;
    
    const bank = state.getState().bank;
    const bankViewElement = bankView; // Store in const for TypeScript
    bankViewElement.innerHTML = ''; // Clear existing content
    bankViewElement.appendChild(createPanelHeader('Bank', 'bank'));

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    for (let i = 0; i < 64; i++) {
        const slotKey = `slot_${i}`;
        const item = bank[slotKey];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot');
        slotEl.dataset.slot = slotKey;

        if (item) {
            slotEl.draggable = true;
            const itemDef = itemDefinitions[item.id] || itemDefinitions['default'];
            const iconEl = createIconElement(itemDef);
            slotEl.appendChild(iconEl);

            const quantityEl = document.createElement('div');
            quantityEl.classList.add('item-quantity');
            quantityEl.textContent = String(item.quantity);
            slotEl.appendChild(quantityEl);
        } else {
            slotEl.innerHTML = `&nbsp;`; // Empty slot
        }
        grid.appendChild(slotEl);
    }
    bankViewElement.appendChild(grid);
}

export function showCraftSuccess(itemId: string) {
    const itemDef = itemDefinitions[itemId] || itemDefinitions.default;
    if (!itemDef || !itemDef.asset) return;

    const container = document.getElementById('effect-container');
    if (!container) return;

    const icon = document.createElement('img');
    icon.src = itemDef.asset;
    icon.className = 'floating-icon';

    if (!inventoryView) return;
    const rect = inventoryView.getBoundingClientRect(); // Changed from inventoryButton
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

export function toggleInfoPanel(panelType: 'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank') {
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
            runes: runesView,
            bank: bankView,
        };

        const panelElement = panelMap[panelType];
        if (panelElement && panelElement.parentElement) {
            panelElement.parentElement.prepend(panelElement);
        }
    }
    updateAllPanels();
}

function updateAllPanels() {
    if (openPanels.has('inventory')) updateInventoryUI();
    if (openPanels.has('crafting')) updateCraftingUI();
    if (openPanels.has('gear')) updateGearUI();
    if (openPanels.has('quest')) updateQuestUI();
    if (openPanels.has('experience')) updateExperienceUI();
    if (openPanels.has('runes')) updateRunesUI();
    if (openPanels.has('bank')) updateBankUI();
}

function updateButtonAndPanelSelection() {
    // Button selection is now handled by React state

    // Views
    // inventoryView is now handled by React - skip it
    if (inventoryView) {
        inventoryView.style.display = openPanels.has('inventory') ? 'flex' : 'none';
    }
    // craftingView is now handled by React - skip it
    if (craftingView) {
        craftingView.style.display = openPanels.has('crafting') ? 'flex' : 'none';
    }
    // gearView is now handled by React - skip it
    if (gearView) {
        gearView.style.display = openPanels.has('gear') ? 'flex' : 'none';
    }
    // questView is now handled by React - skip it
    if (questView) {
        questView.style.display = openPanels.has('quest') ? 'flex' : 'none';
    }
    // experienceView is now handled by React - skip it
    if (experienceView) {
        experienceView.style.display = openPanels.has('experience') ? 'flex' : 'none';
    }
    // runesView is now handled by React - skip it
    if (runesView) {
        runesView.style.display = openPanels.has('runes') ? 'flex' : 'none';
    }
    // bankView is now handled by React - skip it
    if (bankView) {
        bankView.style.display = openPanels.has('bank') ? 'flex' : 'none';
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

export function showDialog(dialogMsg: { npcName?: string, text: string, options: { text: string, action: string, context?: string }[] }, position: {x: number, y: number} | null) {
    // This function is now obsolete - dialog is handled by React
    // Keeping it for compatibility but redirecting to window.showDialog
    const showDialogFn = (window as any).showDialog;
    if (showDialogFn) {
        showDialogFn(dialogMsg, position);
    }
}

export function hideDialog() {
    // This function is now obsolete - dialog is handled by React
    // Keeping it for compatibility but redirecting to window.hideDialog
    const hideDialogFn = (window as any).hideDialog;
    if (hideDialogFn) {
        hideDialogFn();
    } else {
        state.setActiveNpcId(null);
    }
}


export function startCooldown(duration: number): void {
    // This UI element was removed in the new design.
    // We can re-add it later if needed.
    console.log(`Action cooldown started for ${duration}ms`);
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
    const isRecipe = itemDef.kind === 'recipe';

    if (edible || equippable || isRecipe) {
        content += '<hr>';
    }

    if (equippable) {
        content += `<p class="tooltip-action">Equip ${itemDef.text || item.id}</p>`;
        if (equippable.damage) {
            content += `<p class="tooltip-stat">+${equippable.damage} Damage</p>`;
        }
        if (equippable.defense) {
            content += `<p class="tooltip-stat">+${equippable.defense} Defense</p>`;
        }
    }
    
    if (edible) {
        content += `<p class="tooltip-action">Eat ${itemDef.text || item.id}</p>`;
        content += `<p class="tooltip-stat">+${edible.healAmount} Health</p>`;
    }

    if (isRecipe) {
        content += `<p class="tooltip-action">Learn Recipe</p>`;
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
    if (itemDef.equippable?.defense) {
        content += `<p class="tooltip-stat">+${itemDef.equippable.defense} Defense</p>`;
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

export function updateCraftingUI(): void {
    // This function is now obsolete - crafting is handled by React
    // Keeping it for compatibility but it does nothing if craftingView is null
    if (!craftingView) return;
    
    const s = state.getState();
    const inventory = s.inventory;
    const knownRecipes = s.knownRecipes || {};
    craftingView.innerHTML = '';
    craftingView.appendChild(createPanelHeader('Crafting', 'crafting'));

    const counts: { [key: string]: number } = {};
    for (const slot in inventory) {
        if (inventory[slot]) {
            counts[inventory[slot].id] = (counts[inventory[slot].id] || 0) + inventory[slot].quantity;
        }
    }

    let hasKnownRecipes = false;
    for (const itemIdToCraft in recipeDefs) {
        if (knownRecipes[itemIdToCraft]) {
            hasKnownRecipes = true;
            const recipeReqs = recipeDefs[itemIdToCraft];
            const canCraft = Object.keys(recipeReqs).every(reqItemId => (counts[reqItemId] || 0) >= recipeReqs[reqItemId]);

            const itemDef = itemDefinitions[itemIdToCraft] || itemDefinitions['default'];
            
            const button = document.createElement('button');
            button.id = `craft-${itemIdToCraft}-btn`;
            button.classList.add('crafting-recipe');
            button.disabled = !canCraft;
            button.dataset.item = itemIdToCraft;

            const iconEl = createIconElement(itemDef);
            button.appendChild(iconEl);
            
            const recipeForTooltip = { item: itemIdToCraft, req: recipeReqs };
            button.addEventListener('mouseenter', () => showCraftingTooltip(button, recipeForTooltip));
            button.addEventListener('mouseleave', hideCraftingTooltip);
            
            craftingView.appendChild(button);
        }
    }

    if (!hasKnownRecipes) {
        const p = document.createElement('p');
        p.textContent = 'You have not learned any crafting recipes.';
        craftingView.appendChild(p);
    }
}

export function updateQuestUI(): void {
    // This function is now obsolete - quests are handled by React
    // Keeping it for compatibility but it does nothing if questView is null
    if (!questView) return;
    
    const quests = state.getState().quests;
    const allQuests = Object.values(quests);
    const questViewElement = questView; // Store in const for TypeScript

    questViewElement.innerHTML = '';
    questViewElement.appendChild(createPanelHeader('Quests', 'quest'));

    if (allQuests.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No active quests.';
        questViewElement.appendChild(p);
        return;
    }

    for (const quest of allQuests) {
        const questEl = document.createElement('div');
        questEl.className = 'quest';

        const titleEl = document.createElement('h3');
        if (quest.is_complete) {
            titleEl.innerHTML = `${quest.title} <span class="quest-complete">(Completed)</span>`;
        } else {
            titleEl.textContent = quest.title;
        }
        questEl.appendChild(titleEl);

        const objectivesList = document.createElement('ul');
        objectivesList.className = 'quest-objectives';
        if (quest && quest.objectives) {
            quest.objectives.forEach(obj => {
                const objectiveEl = document.createElement('li');
                objectiveEl.textContent = obj.description;
                if (obj.completed) {
                    objectiveEl.className = 'completed';
                }
                objectivesList.appendChild(objectiveEl);
            });
        }
        questEl.appendChild(objectivesList);
        questViewElement.appendChild(questEl);
    }
}

export function updateGearUI(): void {
    // This function is now obsolete - gear is handled by React
    // Keeping it for compatibility but it does nothing if gearView is null
    if (!gearView) return;
    
    const gear = state.getState().gear;
    const gearViewElement = gearView; // Store in const for TypeScript
    gearViewElement.innerHTML = '';
    gearViewElement.appendChild(createPanelHeader('Gear', 'gear'));

    gearSlots.forEach(slot => {
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
            nameEl.textContent = slot.replace('-slot', ''); // e.g. "weapon", "head"
            slotEl.appendChild(nameEl);
        }
        gearViewElement.appendChild(slotEl);
    });
}

export function updateInventoryUI(): void {
    // This function is now obsolete - inventory is handled by React
    // Keeping it for compatibility but it does nothing if inventoryView is null
    if (!inventoryView) return;
    
    const inventory = state.getState().inventory;
    inventoryView.innerHTML = '';
    inventoryView.appendChild(createPanelHeader('Inventory', 'inventory'));

    for (let i = 0; i < 10; i++) {
        const slotKey = `slot_${i}`;
        const item = inventory[slotKey];

        const slotEl = document.createElement('div');
        slotEl.classList.add('inventory-slot');
        slotEl.dataset.slot = slotKey;

        if (item) {
            slotEl.draggable = true;
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
            
            if (itemDef.kind === 'recipe') {
                slotEl.classList.add('learnable');
                slotEl.dataset.slot = slotKey;
            }
            
            slotEl.addEventListener('mouseenter', () => showInventoryTooltip(slotEl, item));
            slotEl.addEventListener('mouseleave', hideInventoryTooltip);
        } else {
            slotEl.innerHTML = `&nbsp;`; // Empty slot
        }
        inventoryView.appendChild(slotEl);
    }
}

export function updateRunesUI(): void {
    // This function is now obsolete - runes are handled by React
    // Keeping it for compatibility but it does nothing if runesView is null
    if (!runesView) return;
    
    const s = state.getState();
    const runes = s.runes || [];
    const activeRune = s.activeRune;
    const runesViewElement = runesView; // Store in const for TypeScript

    runesViewElement.innerHTML = '';
    runesViewElement.appendChild(createPanelHeader('Runes', 'runes'));

    if (runes.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No runes unlocked.';
        runesViewElement.appendChild(p);
        return;
    }

    runes.forEach(runeId => {
        const runeButton = document.createElement('button');
        runeButton.classList.add('rune-button');
        if (runeId === activeRune) {
            runeButton.classList.add('selected');
        }

        const icon = document.createElement('img');
        // TODO: Map runeId to icon
        if (runeId === 'chop_trees') {
            icon.src = 'assets/chop-trees-rune-icon.png';
        } else if (runeId === 'mine_ore') {
            icon.src = 'assets/mine-ore-rune-icon.png';
        }
        runeButton.appendChild(icon);

        runeButton.addEventListener('click', () => {
            const newRune = runeId === activeRune ? '' : runeId;
            send({ type: 'set_rune', payload: { rune: newRune } });
        });

        runesViewElement.appendChild(runeButton);
    });
}

export function updatePlayerIdDisplay() {
    // This is now handled by updatePlayerNameDisplay
}

export function updatePlayerNameDisplay(name: string) {
    if (name) {
        welcomeMessageEl.textContent = `Welcome, ${name}!`;
        // playerNameDisplayEl.textContent = name; This is now a React component
        registrationContainer.style.display = 'none';
        welcomeMessageEl.style.display = 'block';
    } else {
        welcomeMessageEl.style.display = 'none';
    }
}

export function updatePlayerHealth() {
    // This is now handled by the HealthBar React component.
}

export function updateResonanceUI(): void {
    // This is now handled by the ResonanceBar React component.
}

export function updateEchoUI(): void {
    // This is now handled by the EchoButton and ResonanceBar React components.
}

export function updateExperienceUI(): void {
    // This function is now obsolete - experience is handled by React
    // Keeping it for compatibility but it does nothing if experienceView is null
    if (!experienceView) return;
    
    const experience = state.getState().experience;
    const experienceViewElement = experienceView; // Store in const for TypeScript
    experienceViewElement.innerHTML = '';
    experienceViewElement.appendChild(createPanelHeader('Experience', 'experience'));

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
            <div class="skill-icon"><img src="${icon}" alt="${name} icon"></div>
            <div class="skill-info">
                <div class="skill-name">${name} (Level ${level})</div>
                <div class="skill-bar-container">
                    <div class="skill-bar" style="width: ${xpProgress}%"></div>
                </div>
                <div class="skill-xp-text">${Math.floor(xp)} / ${xpForNextLevel} XP</div>
            </div>
        `;

        experienceViewElement.appendChild(skillEl);
    }
}

export function updatePlayerCoords(x: number, y: number) {
    playerCoordsEl.textContent = `(${x}, ${y})`;
}

let channelBarTimeout: number | null = null;

export function showChannelingBar(duration: number) {
	const container = document.getElementById('channeling-container');
	const bar = document.getElementById('channeling-bar');
	if (!container || !bar) return;

	// Clear any existing timer
	if (channelBarTimeout) {
		clearTimeout(channelBarTimeout);
		bar.style.transition = 'none';
		bar.style.width = '0%';
	}
	
	container.style.display = 'block';

	// We trigger the animation slightly after display to ensure the transition plays
	setTimeout(() => {
		bar.style.transition = `width ${duration}ms linear`;
		bar.style.width = '100%';
	}, 10);

	// Hide the bar after the duration
	channelBarTimeout = setTimeout(() => {
		hideChannelingBar();
	}, duration);
}

export function hideChannelingBar() {
	const container = document.getElementById('channeling-container');
	const bar = document.getElementById('channeling-bar');
	if (!container || !bar) return;

	if (channelBarTimeout) {
		clearTimeout(channelBarTimeout);
		channelBarTimeout = null;
	}

	container.style.display = 'none';
	bar.style.transition = 'none';
	bar.style.width = '0%';
}
