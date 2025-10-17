import './styles.css';
import { initializeNetwork } from './network';
import { initializeInput } from './input';

// Initialize all the game modules when the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Game client starting...");
    initializeNetwork();
    initializeInput();
});