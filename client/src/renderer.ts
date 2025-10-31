import * as state from './state';
import { TILE_SIZE } from './constants';
import { getTileProperties, getEntityProperties, itemDefinitions } from './definitions';
import { EntityProperties, ItemProperties, TileProperties } from './types';
import { registerLayer, renderLayers, RenderParams } from './renderer/layers';
import { renderBackground, renderSanctuaries, renderSanctuaryDust, renderWorld, renderEntities, renderDamageIndicators } from './renderer/layers/index';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

export const assetImages: { [key: string]: HTMLImageElement } = {};

// Re-export showDamageIndicator for backwards compatibility
export { showDamageIndicator } from './renderer/layers/index';

// Asset loading functions
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

// Register all rendering layers
function registerRenderingLayers() {
    registerLayer({
        name: 'background',
        order: 0,
        render: renderBackground,
    });

    registerLayer({
        name: 'sanctuaries',
        order: 1,
        render: renderSanctuaries,
    });

    registerLayer({
        name: 'sanctuaryDust',
        order: 2,
        render: renderSanctuaryDust,
    });

    registerLayer({
        name: 'world',
        order: 3,
        render: renderWorld,
    });

    registerLayer({
        name: 'entities',
        order: 4,
        render: renderEntities,
    });

    registerLayer({
        name: 'damageIndicators',
        order: 5,
        render: renderDamageIndicators,
    });

    // Error messages are now rendered via React component, not canvas
}

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

    const params: RenderParams = {
        startX,
        startY,
        viewportWidth,
        viewportHeight,
        viewportWidthInt,
        viewportHeightInt,
        time,
        canvas,
    };

    renderLayers(ctx, params);

    ctx.restore();
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
    
    // Register all rendering layers
    registerRenderingLayers();
    
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
