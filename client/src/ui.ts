import * as state from './state';

// Main Content
let gameCanvas: HTMLElement;

// Bottom Bar - exported for input.ts compatibility
export let inventoryView: HTMLElement | null;
export let craftingView: HTMLElement | null;
export let gearView: HTMLElement | null;
export let questView: HTMLElement | null;
export let experienceView: HTMLElement | null;
export let runesView: HTMLElement | null;
export let bankView: HTMLElement | null;

const openPanels = new Set<'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank'>();

export function initializeUI() {
    // Main Content
    gameCanvas = document.getElementById('game-canvas')!;

    // Bottom Bar - get references for input.ts compatibility
    inventoryView = document.getElementById('inventory-view'); // May be null until React renders
    craftingView = document.getElementById('crafting-view'); // May be null until React renders
    gearView = document.getElementById('gear-view'); // May be null until React renders
    questView = document.getElementById('quest-view');
    experienceView = document.getElementById('experience-view');
    runesView = document.getElementById('runes-view');
    bankView = document.getElementById('bank-view');
}

export function setBuildModeActive(isActive: boolean, buildItem: string | null): void {
    if (isActive && buildItem) {
        gameCanvas.classList.add('build-mode');
    } else {
        gameCanvas.classList.remove('build-mode');
    }
}

export function toggleInfoPanel(panelType: 'inventory' | 'crafting' | 'gear' | 'quest' | 'experience' | 'runes' | 'bank') {
    // Legacy function - React handles panel toggling now, but keeping for compatibility
    const togglePanelFn = (window as any).togglePanel;
    if (togglePanelFn) {
        togglePanelFn(panelType);
    } else {
        // Fallback: manually toggle openPanels set
        if (openPanels.has(panelType)) {
            openPanels.delete(panelType);
        } else {
            openPanels.add(panelType);
        }
    }
}

export function showDialog(dialogMsg: { npcName?: string, text: string, options: { text: string, action: string, context?: string }[] }, position: {x: number, y: number} | null) {
    // Redirect to React Dialog component
    const showDialogFn = (window as any).showDialog;
    if (showDialogFn) {
        showDialogFn(dialogMsg, position);
    }
}

export function hideDialog() {
    // Redirect to React Dialog component
    const hideDialogFn = (window as any).hideDialog;
    if (hideDialogFn) {
        hideDialogFn();
    } else {
        state.setActiveNpcId(null);
    }
}

export function closeBankWindow() {
    const closeBankPanelFn = (window as any).closeBankPanel;
    if (closeBankPanelFn) {
        closeBankPanelFn();
    } else {
        const togglePanelFn = (window as any).togglePanel;
        if (togglePanelFn && openPanels.has('bank')) {
            togglePanelFn('bank');
        } else if (openPanels.has('bank')) {
            toggleInfoPanel('bank');
        }
    }
}

export function startCooldown(duration: number): void {
    // This UI element was removed in the new design.
    // We can re-add it later if needed.
    console.log(`Action cooldown started for ${duration}ms`);
}

export function updatePlayerCoords(_x: number, _y: number) {
    // This function is now obsolete - PlayerCoords React component handles this
    // Keeping for compatibility but it does nothing
}
