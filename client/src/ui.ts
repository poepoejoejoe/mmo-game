import * as state from './state';
import { callWindowFunction, getWindowAPI } from './api/windowApi';

// Main Content
let gameCanvas: HTMLElement;

export function initializeUI() {
    // Main Content
    gameCanvas = document.getElementById('game-canvas')!;
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
