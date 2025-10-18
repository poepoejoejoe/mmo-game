import * as state from './state';
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, TILE_SIZE } from './constants';
import { getTileProperties } from './definitions';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// --- Asset Loading ---
const crackImages: HTMLImageElement[] = [];
let assetsLoaded = false;

// Pre-loads all the crack SVG images into memory for fast rendering.
function loadAssets() {
    const crackSVGs = [
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L7.5 7.5' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 M8 8 L10 9' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 M8 8 L10 9 L12 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11 L3 9 L1 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M1 15 L4 12 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e"
    ];
    
    let loadedCount = 0;
    crackSVGs.forEach((svg, index) => {
        const img = new Image();
        img.src = svg;
        img.onload = () => {
            crackImages[index] = img;
            loadedCount++;
            if (loadedCount === crackSVGs.length) {
                assetsLoaded = true;
                console.log("All crack assets loaded.");
            }
        };
    });
}

// --- Rendering Functions ---

function drawWorld(startX: number, startY: number) {
    if (!ctx) return;

    for (let y = 0; y < VIEWPORT_HEIGHT; y++) {
        for (let x = 0; x < VIEWPORT_WIDTH; x++) {
            const tileX = startX + x;
            const tileY = startY + y;
            const tileData = state.getTileData(tileX, tileY);
            const tileProps = getTileProperties(tileData.type);

            // Draw the base tile color
            ctx.fillStyle = tileProps.color;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Draw health/damage overlay if the tile has a max health
            if (tileProps.maxHealth > 0 && tileData.health < tileProps.maxHealth) {
                if (tileData.health <= 0) {
                    // If health is 0 or less, draw nothing (it will be ground)
                } else {
                    // Draw crack overlay
                    const crackIndex = Math.min(
                        crackImages.length - 1, 
                        Math.floor((1 - (tileData.health / tileProps.maxHealth)) * (crackImages.length - 1))
                    );
                    
                    if (assetsLoaded && crackImages[crackIndex]) {
                        ctx.drawImage(crackImages[crackIndex], x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }
    }
}

// --- RENAMED and UPDATED ---
function drawEntities(startX: number, startY: number) {
    if (!ctx) return;

    const allEntities = state.getState().entities; // <-- UPDATED
    const myPlayerId = state.getState().playerId;

    for (const entityId in allEntities) { // <-- UPDATED
        // Distinguish between this client's player and other entities
        if (entityId === myPlayerId) {
            ctx.fillStyle = '#3498db'; // My player color
        } else {
            // Later, we can check entity type (NPC vs Player)
            ctx.fillStyle = '#e74c3c'; // Other entity color
        }

        const entity = allEntities[entityId]; // <-- UPDATED
        const screenX = (entity.x - startX) * TILE_SIZE;
        const screenY = (entity.y - startY) * TILE_SIZE;

        // Simple square for now
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }
}

// --- Main Game Loop ---\

function render() {
    const me = state.getMyEntity(); // <-- UPDATED
    if (!me || !ctx) return;

    // Clear the entire canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate the top-left corner of the viewport based on the player's position
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

    // Draw layers in order: world first, then entities on top
    drawWorld(startX, startY);
    drawEntities(startX, startY); // <-- UPDATED

    // Update the coordinate display in the UI panel
    document.getElementById('player-coords')!.textContent = `Your Position: (${me.x}, ${me.y})`;
}

// The main game loop function, which calls itself continuously
function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

export function initializeRenderer() {
    canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d')!;

    // Set the canvas dimensions based on our constants
    canvas.width = VIEWPORT_WIDTH * TILE_SIZE;
    canvas.height = VIEWPORT_HEIGHT * TILE_SIZE;

    // Start loading assets
    loadAssets();
}

export function startRenderLoop() {
    // Wait for the initial state to be set before starting the loop
    const checkState = () => {
        if (state.getMyEntity()) { // <-- UPDATED
            console.log("Initial state received. Starting render loop.");
            gameLoop();
        } else {
            // If state isn't ready, check again on the next frame
            requestAnimationFrame(checkState);
        }
    };
    checkState();
}
