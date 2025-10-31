/**
 * Sanctuary Layer
 * 
 * Renders sanctuary boundaries and effects (golden cracks, etc.)
 */

import { TILE_SIZE } from '../../constants';
import { findSanctuaryGroups } from '../../grouper';
import { tracePerimeter, drawSmoothPath, ramerDouglasPeucker } from '../../drawing';
import { SeededRandom } from '../../utils';
import { RenderParams } from '../layers';

const sanctuaryCracksCache = new Map<string, { start: number, len: number, offset: number }[]>();

export function renderSanctuaries(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const startXInt = Math.floor(params.startX);
    const startYInt = Math.floor(params.startY);
    const sanctuaryGroups = findSanctuaryGroups(startXInt, startYInt, params.viewportWidthInt, params.viewportHeightInt);

    for (const group of sanctuaryGroups) {
        if (group.tiles.length === 0) continue;

        const perimeterNodes = tracePerimeter(group);
        if (perimeterNodes.length < 3) continue;

        const offsetX = (params.startX - startXInt) * TILE_SIZE;
        const offsetY = (params.startY - startYInt) * TILE_SIZE;

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
            const pulse = (Math.sin((params.time + crack.offset) / 600) + 1) / 2; // 0-1, slower pulse

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

