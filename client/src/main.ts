import './styles.css';
import { initializeNetwork, addStateUpdateListener } from './network';
import { initializeInput } from './input';
import { initializeRenderer, startRenderLoop } from './renderer';
import { initializeUI } from './ui';
import { getMyEntity } from './state';
import { initializeDrawingRegistry } from './drawing/registryInit';

export function initialize() {
    console.log("Game client starting...");
    
    // Initialize drawing registry first (before renderer needs it)
    initializeDrawingRegistry();
    
    initializeUI();
    initializeRenderer(); // Set up the canvas
    initializeNetwork();
    initializeInput();
    
    startRenderLoop(); // Start the main game loop

    // Listen for state updates to update UI elements that depend on player state
    addStateUpdateListener(() => {
        const me = getMyEntity();
        if (me) {
            // This will be handled by React components
            // updatePlayerCoords(me.x, me.y);
        }
    });
}
