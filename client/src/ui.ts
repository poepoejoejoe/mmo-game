import * as state from './state';
import { callWindowFunction, getWindowAPI } from './api/windowApi';

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
    callWindowFunction('togglePanel', panelType);
    // Fallback: manually toggle openPanels set if function not available
    // Note: We can't check if function exists, so we always try the fallback
    if (openPanels.has(panelType)) {
        openPanels.delete(panelType);
    } else {
        openPanels.add(panelType);
    }
}

export function showDialog(dialogMsg: { npcName?: string, text: string, options: { text: string, action: string, context?: string }[] }, position: {x: number, y: number} | null) {
    // Redirect to React Dialog component
    callWindowFunction('showDialog', dialogMsg, position);
}

export function hideDialog() {
    // Redirect to React Dialog component
    callWindowFunction('hideDialog');
    // Fallback: clear active NPC if React dialog not available
    state.setActiveNpcId(null);
}

export function closeBankWindow() {
    // Close bank panel using the React-managed function
    const windowAPI = getWindowAPI();
    if (windowAPI.closeBankPanel) {
        windowAPI.closeBankPanel();
    } else {
        // Fallback: use togglePanel (will toggle off if open)
        callWindowFunction('togglePanel', 'bank');
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
