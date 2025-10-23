import { TILE_SIZE } from './constants';

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Generates a pseudo-random number between 0 (inclusive) and 1 (exclusive)
    next() {
        // These numbers are chosen to produce a decent distribution.
        this.seed = (this.seed * 9301 + 49297) % 233280;
        // Ensure the result is always positive, even with negative seeds.
        const positiveSeed = (this.seed + 233280) % 233280;
        return positiveSeed / 233280;
    }

    // Generates a pseudo-random integer within a specified range (inclusive)
    nextInt(min: number, max: number) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

export function drawRockTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number) {
    const rand = new SeededRandom(tileX * 1000 + tileY);
    
    const numRocks = rand.nextInt(2, 5);

    for (let i = 0; i < numRocks; i++) {
        const rockRadius = rand.nextInt(4, 10);
        const rockX = rand.nextInt(rockRadius, tileSize - rockRadius);
        const rockY = rand.nextInt(rockRadius, tileSize - rockRadius);
        
        const absoluteX = x * tileSize + rockX;
        const absoluteY = y * tileSize + rockY;

        // Create a jagged, rock-like shape
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

        const baseGray = rand.nextInt(120, 160);

        // Shadow
        ctx.fillStyle = `rgba(0, 0, 0, 0.2)`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x + 1, shape[0].y + 1);
        for (let j = 1; j < vertices; j++) {
            ctx.lineTo(shape[j].x + 1, shape[j].y + 1);
        }
        ctx.closePath();
        ctx.fill();

        // Main rock body
        ctx.fillStyle = `rgb(${baseGray}, ${baseGray}, ${baseGray})`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x, shape[0].y);
        for (let j = 1; j < vertices; j++) {
            ctx.lineTo(shape[j].x, shape[j].y);
        }
        ctx.closePath();
        ctx.fill();

        // Highlight
        const highlightGray = baseGray + 20;
        ctx.fillStyle = `rgba(${highlightGray}, ${highlightGray}, ${highlightGray}, 0.5)`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x - 1, shape[0].y - 1);
        for (let j = 1; j < vertices; j++) {
            // Jitter the highlight path a bit for texture
            ctx.lineTo(shape[j].x - 1 + (rand.next() - 0.5), shape[j].y - 1 + (rand.next() - 0.5));
        }
        ctx.closePath();
        ctx.fill();

         // Cracks/Details
         ctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
         ctx.lineWidth = 1;
         for (let j = 0; j < 2; j++) { // Add 2 cracks
             const startVertex = rand.nextInt(0, vertices - 1);
             const endVertex = (startVertex + rand.nextInt(1, 3)) % vertices;
             ctx.beginPath();
             ctx.moveTo(shape[startVertex].x, shape[startVertex].y);
             ctx.lineTo(shape[endVertex].x, shape[endVertex].y);
             ctx.stroke();
         }
    }
}
