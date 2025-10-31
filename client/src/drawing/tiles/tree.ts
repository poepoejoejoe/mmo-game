/**
 * Tree Tile Drawing
 * 
 * Draws a tree with procedural canopy, leaves, and optional fruit.
 */

import { WorldTile } from '../../types';
import { SeededRandom } from '../../utils';
import { drawPath } from '../utils/pathUtils';
import { SIZE } from '../../utils/drawingConstants';

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, _time: number, tileData: WorldTile) {
    const rand = new SeededRandom(tileX * 1000 + tileY);

    const centerX = x * tileSize + tileSize / 2;
    const centerY = y * tileSize + tileSize / 2;

    const healthPercentage = tileData.health ? (tileData.health / 2) : 1;

    // Trunk
    const trunkRadius = rand.nextInt(2, 4);
    const trunkColor = `rgb(80, 60, 40)`;
    ctx.fillStyle = trunkColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, trunkRadius, 0, 2 * Math.PI);
    ctx.fill();

    if (healthPercentage <= 0) {
        // Just a stump
        return;
    }

    // Create a jagged, irregular canopy shape
    const canopyBaseRadius = (tileSize * SIZE.TREE_CANOPY_BASE + rand.next() * tileSize * SIZE.TREE_CANOPY_VARIATION);
    const jaggedness = 1 + (1 - healthPercentage) * 0.8; // More jagged as health decreases
    const vertices = 12 + rand.nextInt(0, 8);
    const shape = [];
    for (let j = 0; j < vertices; j++) {
        const angle = (j / vertices) * 2 * Math.PI;
        const radius = canopyBaseRadius * (1 + (rand.next() - 0.5) * 0.3 * jaggedness);
        shape.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
        });
    }

    // --- Draw Canopy ---

    // 1. Shadow
    ctx.fillStyle = `rgba(0, 0, 0, 0.3)`;
    const shadowCanopyShape = shape.map(p => ({ x: p.x + 2, y: p.y + 3 }));
    drawPath(ctx, shadowCanopyShape);
    ctx.fill();

    // 2. Base Canopy Color (Darker)
    const baseGreen = 50 + rand.nextInt(0, 25);
    const baseColor = `rgb(${baseGreen - 20}, ${100 + rand.nextInt(0, 50)}, ${baseGreen - 20})`;
    ctx.fillStyle = baseColor;
    drawPath(ctx, shape);
    ctx.fill();

    // 3. Leafy Texture
    const numLeafPatches = Math.round((50 + rand.nextInt(0, 30)) * healthPercentage);
    for (let i = 0; i < numLeafPatches; i++) {
        const patchRadius = canopyBaseRadius * (0.1 + rand.next() * 0.2);
        
        // Find a random point on a circle and then move it inwards
        const angle = rand.next() * 2 * Math.PI;
        const dist = rand.next() * canopyBaseRadius * 0.8;
        const patchX = centerX + Math.cos(angle) * dist;
        const patchY = centerY + Math.sin(angle) * dist;

        const greenVariation = -20 + rand.nextInt(0, 40);
        const alpha = 0.2 + rand.next() * 0.3;
        ctx.fillStyle = `rgba(${baseGreen + greenVariation}, ${140 + greenVariation}, ${baseGreen + greenVariation}, ${alpha})`;

        ctx.beginPath();
        ctx.arc(patchX, patchY, patchRadius, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // 4. Add some fruit/apples, only if health is high
    if (healthPercentage > 0.6 && rand.next() > 0.7) { // 30% chance of having fruit
        const numFruits = Math.round((5 + rand.nextInt(0, 10)) * healthPercentage);
        for (let i = 0; i < numFruits; i++) {
            const angle = rand.next() * 2 * Math.PI;
            const dist = rand.next() * canopyBaseRadius * 0.7; // Keep fruit inside canopy
            const fruitX = centerX + Math.cos(angle) * dist;
            const fruitY = centerY + Math.sin(angle) * dist;
            
            const r = 80 + rand.nextInt(0, 20);
            const g = 70 + rand.nextInt(0, 20);
            const b = 40 + rand.nextInt(0, 10);
            const alpha = 0.6 + rand.next() * 0.2;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(fruitX, fruitY, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

