import './styles.css';
import { initializeNetwork, addStateUpdateListener } from './network';
import { initializeInput } from './input';
import { initializeRenderer, startRenderLoop } from './renderer';
import { initializeUI, updatePlayerCoords } from './ui';
import { getMyEntity } from './state';

// Initialize all the game modules when the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Game client starting...");
    
    initializeUI();
    initializeRenderer(); // Set up the canvas
    initializeNetwork();
    initializeInput();
    
    startRenderLoop(); // Start the main game loop

    // Listen for state updates to update UI elements that depend on player state
    addStateUpdateListener(() => {
        const me = getMyEntity();
        if (me) {
            updatePlayerCoords(me.x, me.y);
        }
    });
});
