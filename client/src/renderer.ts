import * as state from './state';
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, TILE_SIZE } from './constants';
// --- UPDATED ---
import { getTileProperties, getEntityProperties } from './definitions';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// (Asset loading functions remain the same...)
const crackImages: HTMLImageElement[] = [];
let assetsLoaded = false;
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

// (drawWorld remains the same)
function drawWorld(startX: number, startY: number) {
    if (!ctx) return;
    for (let y = 0; y < VIEWPORT_HEIGHT; y++) {
        for (let x = 0; x < VIEWPORT_WIDTH; x++) {
            const tileX = startX + x;
            const tileY = startY + y;
            const tileData = state.getTileData(tileX, tileY);
            const tileProps = getTileProperties(tileData.type);
            ctx.fillStyle = tileProps.color;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            if (tileProps.maxHealth > 0 && tileData.health < tileProps.maxHealth) {
                if (tileData.health <= 0) {
                } else {
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


function drawEntities(startX: number, startY: number) {
    if (!ctx) return;

    const allEntities = state.getState().entities;
    const myPlayerId = state.getState().playerId;

    for (const entityId in allEntities) {
        const entity = allEntities[entityId];
        
        // --- UPDATED ---
        // Get color from our new definition helper
        const props = getEntityProperties(entity.type, entityId, myPlayerId);
        ctx.fillStyle = props.color;
        // --- END UPDATE ---

        const screenX = (entity.x - startX) * TILE_SIZE;
        const screenY = (entity.y - startY) * TILE_SIZE;

        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }
}

// (render, gameLoop, initializeRenderer, startRenderLoop remain the same)
// ...
function render() {
    const me = state.getMyEntity();
    if (!me || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
    const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);
    drawWorld(startX, startY);
    drawEntities(startX, startY);
    document.getElementById('player-coords')!.textContent = `Your Position: (${me.x}, ${me.y})`;
}

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
    canvas.width = VIEWPORT_WIDTH * TILE_SIZE;
    canvas.height = VIEWPORT_HEIGHT * TILE_SIZE;
    loadAssets();
}

export function startRenderLoop() {
    const checkState = () => {
        if (state.getMyEntity()) {
            console.log("Initial state received. Starting render loop.");
            gameLoop();
        } else {
            requestAnimationFrame(checkState);
        }
    };
    checkState();
}