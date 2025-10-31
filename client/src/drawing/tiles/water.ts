/**
 * Water Group Drawing
 * 
 * Draws water tiles as groups with animated noise effects and smooth shorelines.
 */

import { TileGroup } from '../../grouper';
import { drawSmoothPath } from '../utils/pathUtils';
import { tracePerimeter } from '../utils/perimeter';
import { ramerDouglasPeucker } from '../utils/pathUtils';
import { Noise } from '../utils/noise';
import { COLORS } from '../../utils/drawingConstants';

const noiseCanvasCache: { [key: string]: { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } } = {};

export function drawWaterGroup(ctx: CanvasRenderingContext2D, group: TileGroup, startX: number, startY: number, tileSize: number, time: number): void {
    const baseColor = { r: 52, g: 152, b: 219 };
    const shoreColor = COLORS.WATER_SHORE;
    const noise = new Noise(group.tiles[0].x + group.tiles[0].y);

    const perimeterNodes = tracePerimeter(group);
    if (perimeterNodes.length < 3) return; // Cannot draw a shape

    const startXInt = Math.floor(startX);
    const startYInt = Math.floor(startY);
    const offsetX = (startX - startXInt) * tileSize;
    const offsetY = (startY - startYInt) * tileSize;

    // Convert corner nodes to screen coordinates
    const screenPoints = perimeterNodes.map(p => ({
        x: (p.x - startXInt) * tileSize,
        y: (p.y - startYInt) * tileSize,
    }));

    const simplifiedPoints = ramerDouglasPeucker(screenPoints, tileSize * 1.2);

    const midPoints = simplifiedPoints.map((p, i) => {
        const p_next = simplifiedPoints[(i + 1) % simplifiedPoints.length];
        return {
            x: (p.x + p_next.x) / 2,
            y: (p.y + p_next.y) / 2,
        };
    });

    const boundingBox = group.tiles.reduce((acc, tile) => ({
        minX: Math.min(acc.minX, tile.x),
        minY: Math.min(acc.minY, tile.y),
        maxX: Math.max(acc.maxX, tile.x),
        maxY: Math.max(acc.maxY, tile.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const noiseCanvasWidth = (boundingBox.maxX - boundingBox.minX + 1) * tileSize;
    const noiseCanvasHeight = (boundingBox.maxY - boundingBox.minY + 1) * tileSize;

    if (noiseCanvasWidth <= 0 || noiseCanvasHeight <= 0) return;

    // Use a cached canvas if available
    const cacheKey = `${noiseCanvasWidth}x${noiseCanvasHeight}`;
    if (!noiseCanvasCache[cacheKey]) {
        const canvas = document.createElement('canvas');
        canvas.width = noiseCanvasWidth;
        canvas.height = noiseCanvasHeight;
        const noiseCtx = canvas.getContext('2d');
        if (noiseCtx) {
            noiseCanvasCache[cacheKey] = { canvas, ctx: noiseCtx };
        }
    }

    const cached = noiseCanvasCache[cacheKey];
    if (!cached) return;

    const { canvas: noiseCanvas, ctx: noiseCtx } = cached;
    const noiseImageData = noiseCtx.createImageData(noiseCanvasWidth, noiseCanvasHeight);
    const noiseData = noiseImageData.data;

    for (let y = 0; y < noiseCanvasHeight; y++) {
        for (let x = 0; x < noiseCanvasWidth; x++) {
            const i = (y * noiseCanvasWidth + x) * 4;
            
            const worldPixelX = boundingBox.minX * tileSize + x;
            const worldPixelY = boundingBox.minY * tileSize + y;

            const noiseX1 = worldPixelX / 30 + time * 0.00005;
            const noiseY1 = worldPixelY / 30 + time * 0.00005;
            const noiseVal1 = noise.get(noiseX1, noiseY1);

            const noiseX2 = worldPixelX / 15 + time * 0.0001;
            const noiseY2 = worldPixelY / 15 + time * 0.0001;
            const noiseVal2 = noise.get(noiseX2, noiseY2);

            const totalNoise = (noiseVal1 + noiseVal2) * 0.5;
            const brightness = totalNoise * 30;

            noiseData[i]     = baseColor.r + brightness;
            noiseData[i + 1] = baseColor.g + brightness;
            noiseData[i + 2] = baseColor.b + brightness;
            noiseData[i + 3] = 255;
        }
    }
    noiseCtx.putImageData(noiseImageData, 0, 0);

    ctx.save();
    ctx.translate(-offsetX, -offsetY);

    // --- 1. Draw base water color and shore glow ---
    drawSmoothPath(ctx, midPoints);
    ctx.shadowColor = shoreColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fill();

    // --- 2. Draw the noise texture, clipped to the shape ---
    ctx.clip();
    const drawX = (boundingBox.minX - startXInt) * tileSize;
    const drawY = (boundingBox.minY - startYInt) * tileSize;
    ctx.drawImage(noiseCanvas, drawX, drawY);

    ctx.restore();
}

