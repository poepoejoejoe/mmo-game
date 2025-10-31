import * as state from './state';
import { TILE_SIZE, BACKGROUND_TILE_SIZE } from './constants';
import { getTileProperties, getEntityProperties, itemDefinitions } from './definitions';
import { findTileGroups, findSanctuaryGroups } from './grouper';
import { drawWaterGroup, crackImages, drawQuestIndicator, tracePerimeter, drawSmoothPath, ramerDouglasPeucker } from './drawing';
import { SeededRandom } from './utils';
import { EntityProperties, ItemProperties, TileProperties } from './types';
import { CHAT, OPACITY } from './utils/drawingConstants';

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
const DAMAGE_INDICATOR_LIFETIME = 1000; // 1 second - moved to constants but keeping here for now

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
    const assetDefs: (TileProperties | ItemProperties | EntityProperties)[] = [
        ...Object.values(state.getState().world).map(tile => getTileProperties(tile.type)),
        ...Object.values(itemDefinitions),
        ...Object.values(state.getState().entities).map(entity => getEntityProperties(entity.type, entity, state.getState().playerId)),
    ];

    const assetPaths = new Set<string>();
    assetPaths.add('assets/grass-texture.png');
    for (const def of assetDefs) {
        if (def.asset) {
            if (Array.isArray(def.asset)) {
                def.asset.forEach((path: string) => assetPaths.add(path));
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

    const startXInt = Math.floor(startX);
    const startYInt = Math.floor(startY);
    const groups = findTileGroups(startXInt, startYInt, viewportWidth, viewportHeight);

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

const sanctuaryCracksCache = new Map<string, { start: number, len: number, offset: number }[]>();
const sanctuaryDustCache = new Map<string, { x: number, y: number, offset: number, radius: number }[]>();

function drawSanctuaries(startX: number, startY: number, viewportWidth: number, viewportHeight: number, time: number) {
    if (!ctx) return;

    const startXInt = Math.floor(startX);
    const startYInt = Math.floor(startY);
    const sanctuaryGroups = findSanctuaryGroups(startXInt, startYInt, viewportWidth, viewportHeight);

    for (const group of sanctuaryGroups) {
        if (group.tiles.length === 0) continue;

        const perimeterNodes = tracePerimeter(group);
        if (perimeterNodes.length < 3) continue;

        const offsetX = (startX - startXInt) * TILE_SIZE;
        const offsetY = (startY - startYInt) * TILE_SIZE;

        const screenPoints = perimeterNodes.map((p: { x: number, y: number }) => ({
            x: (p.x - startXInt) * TILE_SIZE,
            y: (p.y - startYInt) * TILE_SIZE,
        }));

        const simplifiedPoints = ramerDouglasPeucker(screenPoints, TILE_SIZE * 1.5);
        if (simplifiedPoints.length < 2) continue;
        
        const midPoints = simplifiedPoints.map((p: { x: number, y: number }, i: number) => {
            const p_next = simplifiedPoints[(i + 1) % simplifiedPoints.length];
            return {
                x: (p.x + p_next.x) / 2,
                y: (p.y + p_next.y) / 2,
            };
        });

        const totalLength = midPoints.reduce((acc, p, i) => {
            const p_next = midPoints[(i + 1) % midPoints.length];
            return acc + Math.sqrt(Math.pow(p_next.x - p.x, 2) + Math.pow(p_next.y - p.y, 2));
        }, 0);

        const cacheKey = `${group.tiles[0].x},${group.tiles[0].y}`;
        if (!sanctuaryCracksCache.has(cacheKey)) {
            const rand = new SeededRandom(group.tiles[0].x * 1000 + group.tiles[0].y);
            const cracks = [];

            const numCracks = Math.floor(totalLength / 70); // Denser cracks
            for (let i = 0; i < numCracks; i++) {
                cracks.push({
                    start: rand.next(),
                    len: rand.next() * 0.04 + 0.02, // 2% to 6% of total length - SHORTER
                    offset: rand.next() * 1000,
                });
            }
            sanctuaryCracksCache.set(cacheKey, cracks);

            const dustParticles = [];
            const numParticles = Math.max(8, Math.floor(group.tiles.length / 4));
            for (let i = 0; i < numParticles; i++) {
                const tile = group.tiles[rand.nextInt(0, group.tiles.length - 1)];
                dustParticles.push({
                    x: (tile.x + rand.next()) * TILE_SIZE, // world coords
                    y: (tile.y + rand.next()) * TILE_SIZE, // world coords
                    offset: rand.next() * 5000,
                    radius: rand.next() * 1.2 + 0.5,
                });
            }
            sanctuaryDustCache.set(cacheKey, dustParticles);
        }
        
        const cracks = sanctuaryCracksCache.get(cacheKey)!;
        
        ctx.save();
        ctx.translate(-offsetX, -offsetY);
        drawSmoothPath(ctx, midPoints);

        // 0. Fill the area
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        ctx.fill();

        // 1. Faint, constant base line
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.stroke();

        // 2. Draw each crack with its own pulse
        for (const crack of cracks) {
            const pulse = (Math.sin((time + crack.offset) / 600) + 1) / 2; // 0-1, slower pulse

            if (pulse > 0.1) { // Only draw if "active"
                const crackLength = totalLength * crack.len;
                const startOffset = totalLength * crack.start;
                const intensity = (pulse - 0.1) / 0.9; // Remap pulse from 0.1-1 to 0-1

                const gradientSteps = 5;
                for (let i = 0; i < gradientSteps; i++) {
                    const stepProgress = i / (gradientSteps - 1); // 0 to 1

                    // Segment gets shorter and is centered on the full crack length
                    const segmentLen = crackLength * (1 - stepProgress * 0.7);
                    const segmentStart = startOffset + (crackLength - segmentLen) / 2;
                    
                    const stepIntensity = intensity * (0.4 + stepProgress * 0.6);

                    ctx.save();
                    ctx.setLineDash([segmentLen, totalLength]);
                    ctx.lineDashOffset = -segmentStart;
                    
                    // Outer Glow
                    ctx.lineWidth = 3.5;
                    ctx.strokeStyle = `rgba(255, 215, 0, ${stepIntensity * 0.3})`;
                    ctx.shadowColor = 'rgba(255, 215, 0, 1)';
                    ctx.shadowBlur = 5 + stepIntensity * 12;
                    ctx.stroke();

                    // Inner Core
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = `rgba(255, 255, 224, ${stepIntensity * 0.8})`;
                    ctx.shadowColor = 'rgba(255, 255, 255, 1)';
                    ctx.shadowBlur = 3 + stepIntensity * 6;
                    ctx.stroke();

                    ctx.restore();
                }
            }
        }

        ctx.restore();
    }
}

function drawSanctuaryDust(startX: number, startY: number, viewportWidth: number, viewportHeight: number, time: number) {
    if (!ctx) return;

    const startXInt = Math.floor(startX);
    const startYInt = Math.floor(startY);
    const sanctuaryGroups = findSanctuaryGroups(startXInt, startYInt, viewportWidth, viewportHeight);

    for (const group of sanctuaryGroups) {
        if (group.tiles.length === 0) continue;

        const cacheKey = `${group.tiles[0].x},${group.tiles[0].y}`;
        const particles = sanctuaryDustCache.get(cacheKey)!;

        if (particles) {
            for (const particle of particles) {
                const pulse = (Math.sin((time + particle.offset) / 2000) + 1) / 2;
                const screenX = particle.x - startX * TILE_SIZE;
                const screenY = particle.y - startY * TILE_SIZE;

                const driftX = Math.sin((time + particle.offset * 1.2) / 1500) * 5;
                const driftY = -(pulse * 20);

                ctx.save();
                ctx.beginPath();
                ctx.arc(
                    screenX + driftX,
                    screenY + driftY,
                    particle.radius * pulse,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.5})`;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.fill();
                ctx.restore();
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
            ctx.globalAlpha = OPACITY.SANCTUARY_ENTITY;
        }

        // Draw the entity (player, item, etc.)
        const props = getEntityProperties(entity.type, entity, myPlayerId);
        if (props.draw) {
            props.draw(ctx, screenX, screenY, TILE_SIZE, entity, time, assetImages, props);
        } else {
            // Fallback for entities without a draw function
        }

        ctx.restore();

        if (entity.questState) {
            drawQuestIndicator(ctx, screenX, screenY, TILE_SIZE, time, entity.questState);
        }

        // --- NEW: Render Chat Message ---
        if (entity.lastChatMessage && entity.lastChatTimestamp) {
            const timeSinceChat = Date.now() - entity.lastChatTimestamp;

            if (timeSinceChat < CHAT.DURATION) {
                const fadeAlpha = OPACITY.TEXT_FADE_MAX - (timeSinceChat / CHAT.DURATION) * (OPACITY.TEXT_FADE_MAX - OPACITY.TEXT_FADE_MIN);
                
                ctx.font = `${CHAT.FONT_SIZE}px ${CHAT.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;

                // Simple word wrapping
                const words = entity.lastChatMessage.split(' ');
                let line = '';
                let yOffset = screenY - CHAT.Y_OFFSET;
                const lines = [];

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    if (testWidth > CHAT.MAX_WIDTH && n > 0) {
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
                    yOffset -= CHAT.LINE_HEIGHT;
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

    const camera = state.getState().camera;
    const smoothingFactor = 0.05;
    camera.x += (me.x - camera.x) * smoothingFactor;
    camera.y += (me.y - camera.y) * smoothingFactor;

    const viewportWidth = canvas.width / TILE_SIZE;
    const viewportHeight = canvas.height / TILE_SIZE;

    const startX = camera.x - (viewportWidth / 2);
    const startY = camera.y - (viewportHeight / 2);

    const viewportWidthInt = Math.ceil(viewportWidth) + 1;
    const viewportHeightInt = Math.ceil(viewportHeight) + 1;

    drawBackground(startX, startY);
    drawSanctuaries(startX, startY, viewportWidthInt, viewportHeightInt, time);
    drawSanctuaryDust(startX, startY, viewportWidthInt, viewportHeightInt, time);
    drawWorld(startX, startY, viewportWidthInt, viewportHeightInt, time);
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