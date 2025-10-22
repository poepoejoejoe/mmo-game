import './styles.css';
import { initializeNetwork } from './network';
import { initializeInput } from './input';
import { initializeRenderer, startRenderLoop } from './renderer';
import { initializeUI, promptForRegistration } from './ui';

// Initialize all the game modules when the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Game client starting...");
    
    initializeUI();
    initializeRenderer(); // Set up the canvas
    initializeNetwork();
    initializeInput();
    
    startRenderLoop(); // Start the main game loop
});
