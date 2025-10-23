import * as state from './state';
import { TILE_SIZE, BACKGROUND_TILE_SIZE } from './constants';
// --- UPDATED ---
import { getTileProperties, getEntityProperties, itemDefinitions, tileDefs, entityDefs } from './definitions';
import { findTileGroups } from './grouper';
import { drawRockTile, drawWaterGroup } from './drawing';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// --- NEW: Damage Indicator Management ---
interface DamageIndicator {
    text: string;
    x: number;
    y: number;
    life: number; // Time in ms until it disappears
}
const damageIndicators: DamageIndicator[] = [];
const DAMAGE_INDICATOR_LIFETIME = 1000; // 1 second

export const assetImages: { [key: string]: HTMLImageElement } = {};
let assetsLoaded = false;

export function showDamageIndicator(x: number, y: number, damage: number) {
    damageIndicators.push({
        text: `-${damage}`,
        x: x,
        y: y,
        life: Date.now() + DAMAGE_INDICATOR_LIFETIME,
    });
}

// (Asset loading functions remain the same...)
const crackImages: HTMLImageElement[] = [];
function loadAssets() {
    const assetDefs = [
        ...Object.values(tileDefs),
        ...Object.values(itemDefinitions),
        ...Object.values(entityDefs),
    ];

    const assetPaths = new Set<string>();
    assetPaths.add('assets/agrass-texture.png');
    for (const def of assetDefs) {
        if (def.asset) {
            if (Array.isArray(def.asset)) {
                def.asset.forEach(path => assetPaths.add(path));
            } else {
                assetPaths.add(def.asset);
            }
        }
    }

    let loadedCount = 0;
    const totalAssets = assetPaths.size;
    if (totalAssets === 0) {
        assetsLoaded = true;
        return;
    }

    assetPaths.forEach(path => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
            assetImages[path] = img;
            loadedCount++;
            if (loadedCount === totalAssets) {
                assetsLoaded = true;
                console.log("All game assets loaded.");
            }
        };
    });

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
    
    let loadedCrackCount = 0;
    crackSVGs.forEach((svg, index) => {
        const img = new Image();
        img.src = svg;
        img.onload = () => {
            crackImages[index] = img;
            loadedCrackCount++;
            if (loadedCrackCount === crackSVGs.length) {
                console.log("All crack assets loaded.");
            }
        };
    });
}

function drawBackground(startX: number, startY: number) {
    if (!ctx) return;
    const bgImage = assetImages['assets/grass-texture.png'];
    if (!bgImage) {
        // Fallback for when image not loaded yet
        ctx.fillStyle = '#6B8E23'; // ground color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Create a temporary canvas to draw the scaled-down pattern
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = BACKGROUND_TILE_SIZE;
    tempCanvas.height = BACKGROUND_TILE_SIZE;

    // Draw the grass texture onto the temporary canvas at the desired size
    tempCtx.drawImage(bgImage, 0, 0, BACKGROUND_TILE_SIZE, BACKGROUND_TILE_SIZE);

    const pattern = ctx.createPattern(tempCanvas, 'repeat');
    if (pattern) {
        ctx.fillStyle = pattern;
        ctx.save();
        
        const pixelOffsetX = startX * TILE_SIZE;
        const pixelOffsetY = startY * TILE_SIZE;
        
        ctx.translate(-pixelOffsetX, -pixelOffsetY);
        ctx.fillRect(pixelOffsetX, pixelOffsetY, canvas.width, canvas.height);
        
        ctx.restore();
    }
}

// (drawWorld remains the same)
function drawWorld(startX: number, startY: number, viewportWidth: number, viewportHeight: number, time: number) {
    if (!ctx) return;

    const groups = findTileGroups(startX, startY, viewportWidth, viewportHeight);

    for (const group of groups) {
        if (group.type === 'water') {
            drawWaterGroup(ctx, group, startX, startY, TILE_SIZE, time);
        } else {
            // Fallback to drawing tile by tile for other types
            for (const tile of group.tiles) {
                const x = tile.x - startX;
                const y = tile.y - startY;

                const tileData = state.getTileData(tile.x, tile.y);
                const tileProps = getTileProperties(tileData.type);
                
                if (tileProps.draw) {
                    tileProps.draw(ctx, x, y, TILE_SIZE, tile.x, tile.y, time);
                } else if (tileProps.asset) {
                    let assetPath = tileProps.asset;
                    if (Array.isArray(assetPath)) {
                        assetPath = assetPath[(tile.x + tile.y) % assetPath.length];
                    }
                    const img = assetImages[assetPath];
                    if (img) {
                        ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                } else {
                    ctx.fillStyle = tileProps.color;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

function drawDamageIndicators(startX: number, startY: number) {
    const now = Date.now();
    ctx.font = "bold 16px 'Roboto', sans-serif";
    ctx.textAlign = 'center';

    for (let i = damageIndicators.length - 1; i >= 0; i--) {
        const indicator = damageIndicators[i];

        if (now > indicator.life) {
            damageIndicators.splice(i, 1);
            continue;
        }

        const remainingLife = indicator.life - now;
        const fadeAlpha = Math.min(1, remainingLife / DAMAGE_INDICATOR_LIFETIME);
        const yOffset = (1 - (remainingLife / DAMAGE_INDICATOR_LIFETIME)) * TILE_SIZE;

        const screenX = (indicator.x - startX) * TILE_SIZE + TILE_SIZE / 2;
        const screenY = (indicator.y - startY) * TILE_SIZE - yOffset;

        ctx.fillStyle = `rgba(231, 76, 60, ${fadeAlpha})`;
        ctx.fillText(indicator.text, screenX, screenY);
    }
}


function drawEntities(startX: number, startY: number) {
    if (!ctx) return;

    const allEntities = state.getState().entities;
    const myPlayerId = state.getState().playerId;

    for (const entityId in allEntities) {
        const entity = allEntities[entityId];
        
        // Visibility Rule:
        if (entity.type === 'item') {
            if (entity.owner && entity.owner !== myPlayerId && entity.publicAt && Date.now() < entity.publicAt) {
                continue; // Skip rendering if it's owned by someone else and not yet public
            }
        }

        const screenX = (entity.x - startX) * TILE_SIZE;
        const screenY = (entity.y - startY) * TILE_SIZE;

        if (entity.type === 'item' && entity.itemId) {
            const itemDef = itemDefinitions[entity.itemId] || itemDefinitions['default'];
            if (itemDef.asset && assetImages[itemDef.asset]) {
                ctx.drawImage(assetImages[itemDef.asset], screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = itemDef.color;
                ctx.font = `bold ${TILE_SIZE * 0.8}px 'Roboto', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(itemDef.character, screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2);
            }
        } else {
            const props = getEntityProperties(entity.type, entityId, myPlayerId);
            if (props.asset && assetImages[props.asset]) {
                ctx.drawImage(assetImages[props.asset], screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = props.color;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }
        }

        // --- NEW: Render Chat Message ---
        if (entity.lastChatMessage && entity.lastChatTimestamp) {
            const CHAT_MESSAGE_DURATION = 5000; // 5 seconds
            const timeSinceChat = Date.now() - entity.lastChatTimestamp;

            if (timeSinceChat < CHAT_MESSAGE_DURATION) {
                const fadeAlpha = 1.0 - (timeSinceChat / CHAT_MESSAGE_DURATION);
                
                ctx.font = "12px 'Inter', sans-serif";
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;

                // Simple word wrapping
                const maxWidth = 150;
                const words = entity.lastChatMessage.split(' ');
                let line = '';
                let yOffset = screenY - 10;
                const lineHeight = 14;
                const lines = [];

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    if (testWidth > maxWidth && n > 0) {
                        lines.push(line);
                        line = words[n] + ' ';
                    } else {
                        line = testLine;
                    }
                }
                lines.push(line);
                
                // Draw the text lines, starting from the bottom up
                for (let i = lines.length - 1; i >= 0; i--) {
                    ctx.fillText(lines[i].trim(), screenX + TILE_SIZE / 2, yOffset);
                    yOffset -= lineHeight;
                }
            }
        }
    }
}

// (render, gameLoop, initializeRenderer, startRenderLoop remain the same)
// ...
function render(time: number) {
    const me = state.getMyEntity();
    if (!me || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const viewportWidth = Math.ceil(canvas.width / TILE_SIZE);
    const viewportHeight = Math.ceil(canvas.height / TILE_SIZE);

    const startX = me.x - Math.floor(viewportWidth / 2);
    const startY = me.y - Math.floor(viewportHeight / 2);

    drawBackground(startX, startY);
    drawWorld(startX, startY, viewportWidth, viewportHeight, time);
    drawEntities(startX, startY);
    drawDamageIndicators(startX, startY);
    
    // updatePlayerCoords is now called from main.ts on state update.
    // document.getElementById('player-coords')!.textContent = `Your Position: (${me.x}, ${me.y})`;
}

function gameLoop(time: number) {
    render(time);
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    if (!canvas || !mainContent) return;

    const rect = mainContent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // We might need to re-render here if the aspect ratio changes significantly
    // For now, the gameLoop will handle the continuous rendering.
}

export function initializeRenderer() {
    canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d')!;
    
    // Initial resize
    resizeCanvas();

    // Resize canvas when the window is resized
    window.addEventListener('resize', resizeCanvas);
    
    loadAssets();
}

export function startRenderLoop() {
    const checkState = () => {
        if (state.getMyEntity()) {
            console.log("Initial state received. Starting render loop.");
            requestAnimationFrame(gameLoop);
        } else {
            requestAnimationFrame(checkState);
        }
    };
    checkState();
}