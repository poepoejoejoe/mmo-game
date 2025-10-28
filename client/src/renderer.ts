import * as state from './state';
import { TILE_SIZE, BACKGROUND_TILE_SIZE } from './constants';
// --- UPDATED ---
import { getTileProperties, getEntityProperties, itemDefinitions, tileDefs, entityDefs } from './definitions';
import { findTileGroups, findSanctuaryGroups } from './grouper';
import { drawWaterGroup, crackImages, drawQuestIndicator, tracePerimeter, drawSmoothPath, ramerDouglasPeucker } from './drawing';

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

export function showDamageIndicator(x: number, y: number, damage: number) {
    damageIndicators.push({
        text: `-${damage}`,
        x: x,
        y: y,
        life: Date.now() + DAMAGE_INDICATOR_LIFETIME,
    });
}

// (Asset loading functions remain the same...)
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
        return;
    }

    assetPaths.forEach(path => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
            assetImages[path] = img;
            loadedCount++;
            if (loadedCount === totalAssets) {
                console.log("All game assets loaded.");
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
                    tileProps.draw(ctx, x, y, TILE_SIZE, tile.x, tile.y, time, tileData);
                } else if (tileProps.asset) {
                    let assetPath = tileProps.asset;
                    if (Array.isArray(assetPath)) {
                        assetPath = assetPath[(tile.x + tile.y) % assetPath.length];
                    }
                    const img = assetImages[assetPath];
                    if (img) {
                        ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }

                    if (tileProps.isDestructible && tileProps.maxHealth > 0 && tileData.health < tileProps.maxHealth) {
                        const damageRatio = 1 - (tileData.health / tileProps.maxHealth);
                        const crackIndex = Math.min(Math.floor(damageRatio * crackImages.length), crackImages.length - 1);
                        const crackImg = crackImages[crackIndex];
                        if (crackImg) {
                            ctx.drawImage(crackImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }
                } else {
                    ctx.fillStyle = tileProps.color;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

function drawSanctuaries(startX: number, startY: number, viewportWidth: number, viewportHeight: number, time: number) {
    if (!ctx) return;

    const sanctuaryGroups = findSanctuaryGroups(startX, startY, viewportWidth, viewportHeight);

    for (const group of sanctuaryGroups) {
        // 1. Draw the pulsing glow
        const pulse = Math.sin(time / 400) * 4 + 8;
        const perimeterNodes = tracePerimeter(group);
        if (perimeterNodes.length < 3) continue;

        const screenPoints = perimeterNodes.map((p: {x: number, y: number}) => ({
            x: (p.x - startX) * TILE_SIZE,
            y: (p.y - startY) * TILE_SIZE,
        }));

        const simplifiedPoints = ramerDouglasPeucker(screenPoints, TILE_SIZE * 1.5);

        const midPoints = simplifiedPoints.map((p: {x: number, y: number}, i: number) => {
            const p_next = simplifiedPoints[(i + 1) % simplifiedPoints.length];
            return {
                x: (p.x + p_next.x) / 2,
                y: (p.y + p_next.y) / 2,
            };
        });

        ctx.save();
        
        drawSmoothPath(ctx, midPoints);

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 215, 0, 1)';
        ctx.shadowBlur = pulse;
        ctx.stroke();
        ctx.restore();

        // 2. Fill the area with a transparent color
        ctx.save();
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        // We can reuse the path from the border for filling
        ctx.fill(); 
        ctx.restore();
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


function drawEntities(startX: number, startY: number, time: number) {
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

        ctx.save();

        const tile = state.getTileData(entity.x, entity.y);
        const onSanctuary = tile && tile.isSanctuary;

        if (onSanctuary) {
            // Ethereal State (on sanctuary): Slight transparency.
            ctx.globalAlpha = 0.8;
        }

        // Draw the entity (player, item, etc.)
        const props = getEntityProperties(entity.type, entity, myPlayerId);
        if (props.draw) {
            props.draw(ctx, screenX, screenY, TILE_SIZE, entity, time, assetImages);
        } else if (props.asset && assetImages[props.asset]) {
            ctx.drawImage(assetImages[props.asset], screenX, screenY, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.fillStyle = props.color;
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        ctx.restore();

        if (entity.questState) {
            drawQuestIndicator(ctx, screenX, screenY, TILE_SIZE, time, entity.questState);
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
function render(time: number) {
    const me = state.getMyEntity();
    if (!me || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    const viewportWidth = Math.ceil(canvas.width / TILE_SIZE);
    const viewportHeight = Math.ceil(canvas.height / TILE_SIZE);

    const startX = me.x - Math.floor(viewportWidth / 2);
    const startY = me.y - Math.floor(viewportHeight / 2);

    drawBackground(startX, startY);
    drawSanctuaries(startX, startY, viewportWidth, viewportHeight, time);
    drawWorld(startX, startY, viewportWidth, viewportHeight, time);
    drawEntities(startX, startY, time);
    drawDamageIndicators(startX, startY);

    ctx.restore();
    
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