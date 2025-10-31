/**
 * Iron Rock Tile Drawing
 * 
 * Draws an iron rock tile with metallic properties and speckles.
 */

import { WorldTile } from '../../types';
import { SeededRandom } from '../../utils';
import { drawPath } from '../utils/pathUtils';

export function drawIronRockTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, _time: number, tileData: WorldTile) {
    const rand = new SeededRandom(tileX * 1000 + tileY);

    const healthPercentage = tileData.health ? (tileData.health / 8) : 1;

    // Determine the max number of rocks and pre-generate their properties
    const maxRocks = rand.nextInt(2, 5);
    const rockProps = [];
    for (let i = 0; i < maxRocks; i++) {
        const rockRadius = rand.nextInt(4, 10);
        const rockX = rand.nextInt(rockRadius, tileSize - rockRadius);
        const rockY = rand.nextInt(rockRadius, tileSize - rockRadius);
        
        const absoluteX = x * tileSize + rockX;
        const absoluteY = y * tileSize + rockY;

        const vertices = rand.nextInt(5, 9);
        const shape = [];
        for (let j = 0; j < vertices; j++) {
            const angle = (j / vertices) * 2 * Math.PI;
            const radius = rockRadius * (1 + (rand.next() - 0.5) * 0.4);
            shape.push({
                x: absoluteX + Math.cos(angle) * radius,
                y: absoluteY + Math.sin(angle) * radius,
            });
        }
        rockProps.push({ shape, vertices });
    }

    // Determine how many rocks to draw based on health
    const numRocksToDraw = Math.ceil(maxRocks * healthPercentage);

    for (let i = 0; i < numRocksToDraw; i++) {
        const { shape, vertices } = rockProps[i];

        const baseGray = rand.nextInt(70, 100);

        // Shadow
        ctx.fillStyle = `rgba(0, 0, 0, 0.3)`;
        const shadowShape = shape.map(p => ({ x: p.x + 2, y: p.y + 2 }));
        drawPath(ctx, shadowShape);
        ctx.fill();

        // Main rock body - darker and cooler gray for iron
        ctx.fillStyle = `rgb(${baseGray}, ${baseGray + 5}, ${baseGray + 15})`;
        drawPath(ctx, shape);
        ctx.fill();

        // Highlight
        const highlightGray = baseGray + 40;
        ctx.fillStyle = `rgba(${highlightGray}, ${highlightGray + 5}, ${highlightGray + 15}, 0.7)`;
        const highlightShape = shape.map(p => ({ x: p.x - 1 + (rand.next() - 0.5), y: p.y - 1 + (rand.next() - 0.5) }));
        drawPath(ctx, highlightShape);
        ctx.fill();

        // Metallic speckles for iron - more and brighter
        const numSpeckles = rand.nextInt(15, 25);
        for (let j = 0; j < numSpeckles; j++) {
            const speckleSize = rand.next() * 3 + 1.5;
            const pointOnRock = shape[rand.nextInt(0, vertices - 1)];
            const offsetX = (rand.next() - 0.5) * 10;
            const offsetY = (rand.next() - 0.5) * 10;
            const speckleX = pointOnRock.x + offsetX;
            const speckleY = pointOnRock.y + offsetY;
            
            ctx.fillStyle = `rgba(220, 220, 235, ${rand.next() * 0.5 + 0.5})`;
            ctx.beginPath();
            ctx.arc(speckleX, speckleY, speckleSize / 2, 0, 2 * Math.PI);
            ctx.fill();
        }

         // Cracks/Details
         const numCracks = Math.floor(8 * (1 - healthPercentage));
         if (numCracks > 0) {
            ctx.strokeStyle = `rgba(0, 0, 0, 0.4)`;
            ctx.lineWidth = 1;
            for (let j = 0; j < numCracks; j++) {
                const startVertex = rand.nextInt(0, vertices - 1);
                const endVertex = (startVertex + rand.nextInt(1, 3)) % vertices;
                ctx.beginPath();
                ctx.moveTo(shape[startVertex].x, shape[startVertex].y);
                ctx.lineTo(shape[endVertex].x, shape[endVertex].y);
                ctx.stroke();
            }
         }
    }
}

