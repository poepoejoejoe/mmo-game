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
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M8 8 L10 9 L12 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M8 8 L10 9 L12 11 M8 8 L7 10 L5 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 M8 8 L10 9 L12 11 L14 10 M8 8 L7 10 L5 11 L3 9' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 M8 8 L7 10 L5 11 L3 9 L1 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M1 15 L4 12 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4 L5 5' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
        "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M1 15 L4 12 M4 12 L6 13 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M15 15 L14 16 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4 L5 5 M3 4 L2 2 M8 8 L9 7 M12 5 L14 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.8' fill='none'/%3e%3c/svg%3e",
    ];

    let loadedCount = 0;
    crackSVGs.forEach(svgData => {
        const img = new Image();
        img.src = svgData;
        img.onload = () => {
            loadedCount++;
            if (loadedCount === crackSVGs.length) {
                assetsLoaded = true;
                console.log("Crack assets loaded.");
            }
        };
        crackImages.push(img);
    });
}

// --- Drawing Functions ---

function drawWorld(startX: number, startY: number) {
    for (let j = 0; j < VIEWPORT_HEIGHT; j++) {
        for (let i = 0; i < VIEWPORT_WIDTH; i++) {
            const worldX = startX + i;
            const worldY = startY + j;
            const tileData = state.getTileData(worldX, worldY);
            const props = getTileProperties(tileData.type);

            // Draw the base tile color
            ctx.fillStyle = props.color;
            ctx.fillRect(i * TILE_SIZE, j * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Draw crack overlays on top if the tile is damaged
            if (assetsLoaded && (props.isGatherable || props.isDestructible)) {
                if (tileData.health < props.maxHealth) {
                    const damagePercent = 1 - (tileData.health / props.maxHealth);
                    const crackStage = Math.min(9, Math.floor(damagePercent * 10));
                    ctx.drawImage(crackImages[crackStage], i * TILE_SIZE, j * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

function drawPlayers(startX: number, startY: number) {
    const clientState = state.getState();
    for (const playerId in clientState.players) {
        const player = clientState.players[playerId];
        const screenX = (player.x - startX) * TILE_SIZE;
        const screenY = (player.y - startY) * TILE_SIZE;
        
        ctx.fillStyle = playerId === clientState.playerId ? '#3498db' : '#e74c3c';
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }
}

// --- Main Game Loop ---

function render() {
    const me = state.getMyPlayer();
    if (!me || !ctx) return;

    // Clear the entire canvas for the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate the top-left corner of the viewport based on the player's position
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

    // Draw layers in order: world first, then players on top
    drawWorld(startX, startY);
    drawPlayers(startX, startY);

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

    // Begin loading visual assets
    loadAssets();
}

export function startRenderLoop() {
    // Kick off the continuous rendering loop
    gameLoop();
}
