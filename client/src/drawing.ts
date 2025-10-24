import { TileGroup } from './grouper';
import { EntityState } from './types';
import * as state from './state';
import { itemDefinitions } from './definitions';

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        const positiveSeed = (this.seed + 233280) % 233280;
        return positiveSeed / 233280;
    }

    nextInt(min: number, max: number) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

// Note: drawRockTile is simplified as neighbors are no longer needed
export function drawRockTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, _time: number, tileData: any) {
    const rand = new SeededRandom(tileX * 1000 + tileY);

    const healthPercentage = tileData.health ? (tileData.health / 4) : 1;
    
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

        const baseGray = rand.nextInt(80, 120);

        // Shadow
        ctx.fillStyle = `rgba(0, 0, 0, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x + 2, shape[0].y + 2);
        for (let j = 1; j < vertices; j++) {
            ctx.lineTo(shape[j].x + 2, shape[j].y + 2);
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
        const highlightGray = baseGray + 40;
        ctx.fillStyle = `rgba(${highlightGray}, ${highlightGray}, ${highlightGray}, 0.7)`;
        ctx.beginPath();
        ctx.moveTo(shape[0].x - 1, shape[0].y - 1);
        for (let j = 1; j < vertices; j++) {
            // Jitter the highlight path a bit for texture
            ctx.lineTo(shape[j].x - 1 + (rand.next() - 0.5), shape[j].y - 1 + (rand.next() - 0.5));
        }
        ctx.closePath();
        ctx.fill();

         // Cracks/Details
         const numCracks = Math.floor(4 * (1 - healthPercentage));
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

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, _time: number, tileData: any) {
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
    const canopyBaseRadius = (tileSize * 0.4 + rand.next() * tileSize * 0.1);
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
    ctx.beginPath();
    ctx.moveTo(shape[0].x + 2, shape[0].y + 3);
    for (let j = 1; j < vertices; j++) {
        ctx.lineTo(shape[j].x + 2, shape[j].y + 3);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Base Canopy Color (Darker)
    const baseGreen = 50 + rand.nextInt(0, 25);
    const baseColor = `rgb(${baseGreen - 20}, ${100 + rand.nextInt(0, 50)}, ${baseGreen - 20})`;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(shape[0].x, shape[0].y);
    for (let j = 1; j < vertices; j++) {
        ctx.lineTo(shape[j].x, shape[j].y);
    }
    ctx.closePath();
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


class Noise {
    private p: number[] = [];
    constructor(seed: number) {
        const rand = new SeededRandom(seed);
        const p = Array.from({ length: 256 }, () => Math.floor(rand.next() * 256));
        this.p = p.concat(p);
    }
    private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    private lerp(t: number, a: number, b: number) { return a + t * (b - a); }
    private grad(hash: number, x: number, y: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    get(x: number, y: number) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = this.fade(x), v = this.fade(y);
        const p = this.p;
        const A = p[X] + Y, B = p[X + 1] + Y;
        return this.lerp(v,
            this.lerp(u, this.grad(p[A], x, y), this.grad(p[B], x - 1, y)),
            this.lerp(u, this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1))
        );
    }
}

function tracePerimeter(group: TileGroup): { x: number, y: number }[] {
    const tileSet = new Set(group.tiles.map(t => `${t.x},${t.y}`));
    const startNode = group.tiles.reduce((a, b) => a.y < b.y ? a : (a.y === b.y && a.x < b.x ? a : b));

    const path: { x: number, y: number }[] = [];
    let current = { x: startNode.x, y: startNode.y };
    let dir = 0; // 0: N, 1: E, 2: S, 3: W

    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];

    do {
        // From current tile, which corner are we at based on 'dir'
        let cornerX = current.x;
        let cornerY = current.y;
        if (dir === 0) { /* Coming from South, at NW corner */ }
        if (dir === 1) { cornerX += 1; /* Coming from West, at NE corner */ }
        if (dir === 2) { cornerX += 1; cornerY += 1; /* Coming from North, at SE corner */ }
        if (dir === 3) { cornerY += 1; /* Coming from East, at SW corner */ }
        path.push({ x: cornerX, y: cornerY });

        // Try to turn left
        const leftDir = (dir + 3) % 4;
        const leftTileX = current.x + dx[leftDir];
        const leftTileY = current.y + dy[leftDir];
        if (tileSet.has(`${leftTileX},${leftTileY}`)) {
            current = { x: leftTileX, y: leftTileY };
            dir = leftDir;
            continue;
        }

        // Try to go straight
        const straightTileX = current.x + dx[dir];
        const straightTileY = current.y + dy[dir];
        if (tileSet.has(`${straightTileX},${straightTileY}`)) {
            current = { x: straightTileX, y: straightTileY };
            continue;
        }
        
        // Must turn right
        dir = (dir + 1) % 4;

    } while (current.x !== startNode.x || current.y !== startNode.y || dir !== 0);

    return path;
}

export function drawWaterGroup(ctx: CanvasRenderingContext2D, group: TileGroup, startX: number, startY: number, tileSize: number, time: number) {
    const rand = new SeededRandom(group.tiles[0].x * 1000 + group.tiles[0].y);
    const baseColor = { r: 52, g: 152, b: 219 };
    const shoreColor = 'rgba(88, 178, 233, 0.7)';
    const noise = new Noise(group.tiles[0].x + group.tiles[0].y);

    const perimeterNodes = tracePerimeter(group);
    if (perimeterNodes.length < 3) return; // Cannot draw a shape

    // Convert corner nodes to screen coordinates
    const screenPoints = perimeterNodes.map(p => ({
        x: (p.x - startX) * tileSize,
        y: (p.y - startY) * tileSize,
    }));

    // Add a small, controlled jitter to the corner points for a natural look
    const jitteredPoints = screenPoints.map(p => ({
        x: p.x + (rand.next() - 0.5) * tileSize * 0.4,
        y: p.y + (rand.next() - 0.5) * tileSize * 0.4,
    }));

    ctx.save();

    // --- 1. Create a smooth path for the shoreline ---
    ctx.beginPath();
    
    // Move to the midpoint of the last and first segments
    const startMid = {
        x: (jitteredPoints[jitteredPoints.length - 1].x + jitteredPoints[0].x) / 2,
        y: (jitteredPoints[jitteredPoints.length - 1].y + jitteredPoints[0].y) / 2,
    };
    ctx.moveTo(startMid.x, startMid.y);

    // Use quadratic curves to smooth the path between midpoints, using the original points as controls
    for (let i = 0; i < jitteredPoints.length; i++) {
        const p1 = jitteredPoints[i];
        const p2 = jitteredPoints[(i + 1) % jitteredPoints.length];
        
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
    }
    ctx.closePath();

    // --- 2. Draw the base water color and shoreline ---
    ctx.shadowColor = shoreColor;
    ctx.shadowBlur = 20; // Increased blur for a softer effect
    ctx.fillStyle = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
    ctx.fill();

    // Fill again to make the center opaque after the blur
    ctx.shadowColor = 'transparent';
    ctx.fill();

    // --- 3. Animate the water surface with noise ---
    ctx.clip(); // Confine the effect to the water body
    const boundingBox = group.tiles.reduce((acc, tile) => ({
        minX: Math.min(acc.minX, tile.x),
        minY: Math.min(acc.minY, tile.y),
        maxX: Math.max(acc.maxX, tile.x),
        maxY: Math.max(acc.maxY, tile.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const drawX = (boundingBox.minX - startX) * tileSize;
    const drawY = (boundingBox.minY - startY) * tileSize;
    const width = (boundingBox.maxX - boundingBox.minX + 1) * tileSize;
    const height = (boundingBox.maxY - boundingBox.minY + 1) * tileSize;
    
    if (width <= 0 || height <= 0) {
        ctx.restore();
        return;
    }

    const imageData = ctx.getImageData(drawX, drawY, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            if (ctx.isPointInPath(drawX + x, drawY + y)) {
                const noiseX1 = (drawX + x) / 30 + time * 0.00005;
                const noiseY1 = (drawY + y) / 30 + time * 0.00005;
                const noiseVal1 = noise.get(noiseX1, noiseY1);

                const noiseX2 = (drawX + x) / 15 + time * 0.0001;
                const noiseY2 = (drawY + y) / 15 + time * 0.0001;
                const noiseVal2 = noise.get(noiseX2, noiseY2);

                const totalNoise = (noiseVal1 + noiseVal2) * 0.5;
                const brightness = totalNoise * 30; // How much to lighten/darken

                data[i] = baseColor.r + brightness;
                data[i + 1] = baseColor.g + brightness;
                data[i + 2] = baseColor.b + brightness;
                data[i + 3] = 255;
            }
        }
    }
    ctx.putImageData(imageData, drawX, drawY);

    ctx.restore();
}

export function drawWaterTile() { /* This function is now obsolete */ }

function drawPlayerFacingDown(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 8;
    const legWidth = pixelSize * 3;

    // --- Legs (drawn first) ---
    ctx.fillStyle = colors.pantsColor;
    const legY = pixelSize * 2;
    // Left Leg
    ctx.fillRect(-pixelSize * 4, legY + (isMoving && walkCycle === 1 ? pixelSize : 0), legWidth, pixelSize * 4);
    // Right Leg
    ctx.fillRect(pixelSize, legY + (isMoving && walkCycle === 0 ? pixelSize : 0), legWidth, pixelSize * 4);

    // --- Arms ---
    ctx.fillStyle = colors.skinColor;
    const armY = -pixelSize * 3;
    const armHeight = pixelSize * 5;
    // Left Arm
    ctx.fillRect(-torsoWidth / 2 - pixelSize * 2, armY + (isMoving && walkCycle === 1 ? pixelSize : 0), pixelSize * 2, armHeight);
    // --- Right Arm 
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(torsoWidth / 2, armY + (isMoving && walkCycle === 0 ? pixelSize : 0), pixelSize * 2, armHeight);

    // --- Torso ---
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);

    // --- Head ---
    const headX = -pixelSize * 4;
    const headY = -pixelSize * 9;
    // Hair
    ctx.fillStyle = colors.hairColor;
    ctx.fillRect(headX - pixelSize, headY + pixelSize, pixelSize * 10, pixelSize * 8);
    // Face
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(headX, headY + pixelSize * 4, pixelSize * 8, pixelSize * 4);
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(headX + pixelSize * 2, headY + pixelSize * 5, pixelSize, pixelSize * 2);
    ctx.fillRect(headX + pixelSize * 5, headY + pixelSize * 5, pixelSize, pixelSize * 2);


}

function drawPlayerFacingUp(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 8;
    const legWidth = pixelSize * 3;

    // --- Legs ---
    ctx.fillStyle = colors.pantsColor;
    const legY = pixelSize * 2;
    ctx.fillRect(-pixelSize * 4, legY + (isMoving && walkCycle === 1 ? pixelSize : 0), legWidth, pixelSize * 4);
    ctx.fillRect(pixelSize, legY + (isMoving && walkCycle === 0 ? pixelSize : 0), legWidth, pixelSize * 4);

    // --- Arms ---
    ctx.fillStyle = colors.skinColor;
    const armY = -pixelSize * 3;
    const armHeight = pixelSize * 5;
    ctx.fillRect(-torsoWidth / 2 - pixelSize * 2, armY + (isMoving && walkCycle === 1 ? pixelSize : 0), pixelSize * 2, armHeight);
    
    // --- Right Arm ---
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(torsoWidth / 2, armY + (isMoving && walkCycle === 0 ? pixelSize : 0), pixelSize * 2, armHeight);

    // --- Torso ---
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);

    // --- Head (Back) ---
    const headX = -pixelSize * 4;
    const headY = -pixelSize * 9;
    ctx.fillStyle = colors.hairColor;
    ctx.fillRect(headX - pixelSize, headY + pixelSize, pixelSize * 10, pixelSize * 8); // Full hair, no face
}

function drawPlayerFacingSide(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 4;
    const legWidth = pixelSize * 3;
    const armWidth = pixelSize * 2;

    // --- Far Leg ---
    ctx.fillStyle = colors.pantsColor;
    const legY = pixelSize * 2;
    ctx.fillRect(-pixelSize / 2, legY + (isMoving && walkCycle === 1 ? -pixelSize : 0), legWidth, pixelSize * 4);

    // --- Far Arm ---
    ctx.fillStyle = colors.skinColor;
    const armY = -pixelSize * 3;
    ctx.fillRect(-armWidth / 2, armY + (isMoving && walkCycle === 1 ? -pixelSize : 0), armWidth, pixelSize * 4);

    // --- Torso ---
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);

    // --- Near Leg ---
    ctx.fillStyle = colors.pantsColor;
    ctx.fillRect(-pixelSize * 1.5, legY + (isMoving && walkCycle === 0 ? pixelSize : 0), legWidth, pixelSize * 4);

    // --- Head ---
    const headX = -pixelSize * 3;
    const headY = -pixelSize * 9;
    // Hair
    ctx.fillStyle = colors.hairColor;
    ctx.fillRect(headX, headY + pixelSize, pixelSize * 7, pixelSize * 8);
    // Face
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(headX + pixelSize * 5, headY + pixelSize * 4, pixelSize * 2, pixelSize * 4);
    // Eye
    ctx.fillStyle = '#000000';
    ctx.fillRect(headX + pixelSize * 5, headY + pixelSize * 5, pixelSize, pixelSize * 2);

    // --- Near Arm (drawn last to be on top of torso but behind head) ---
    // This is the key change: we draw this arm AFTER the torso and leg, but BEFORE the head.
    // Wait, that's not right. We need to draw it after torso but before head.
    // Let's re-order.

}

function reorderedDrawPlayerFacingSide(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 4;
    const legWidth = pixelSize * 3;
    const armWidth = pixelSize * 2;
    const legY = pixelSize * 2;
    const armY = -pixelSize * 3;

    // 1. Draw Far Limbs
    ctx.fillStyle = colors.pantsColor;
    ctx.fillRect(-pixelSize / 2, legY + (isMoving && walkCycle === 1 ? -pixelSize : 0), legWidth, pixelSize * 4);
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(-armWidth / 2, armY + (isMoving && walkCycle === 1 ? -pixelSize : 0), armWidth, pixelSize * 4);

    // 2. Draw Torso
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);

    // 3. Draw Near Leg
    ctx.fillStyle = colors.pantsColor;
    ctx.fillRect(-pixelSize * 1.5, legY + (isMoving && walkCycle === 0 ? pixelSize : 0), legWidth, pixelSize * 4);

    // 4. Draw Near Arm (behind head)
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(-armWidth / 2, armY + (isMoving && walkCycle === 0 ? pixelSize : 0), armWidth, pixelSize * 4);

    // 5. Draw Head (on top of near arm)
    const headX = -pixelSize * 3;
    const headY = -pixelSize * 9;
    // Hair
    ctx.fillStyle = colors.hairColor;
    ctx.fillRect(headX, headY + pixelSize, pixelSize * 7, pixelSize * 8);
    // Face
    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(headX + pixelSize * 5, headY + pixelSize * 4, pixelSize * 2, pixelSize * 4);
    // Eye
    ctx.fillStyle = '#000000';
    ctx.fillRect(headX + pixelSize * 5, headY + pixelSize * 5, pixelSize, pixelSize * 2);
}


export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }) {
    ctx.imageSmoothingEnabled = false;

    const pixelSize = Math.max(1, Math.floor(tileSize / 16));

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200);
    const walkCycle = isMoving ? Math.floor(time / 200) % 2 : 0;

    const colors = {
        hairColor: '#634b3a',
        skinColor: '#d3a07c',
        shirtColor: '#7b9c48',
        pantsColor: '#6d533b',
        shirtStripeColor: '#9abe6d'
    };

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(centerX, y + tileSize - pixelSize * 2, pixelSize * 6, pixelSize * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);

    const direction = entity.direction || 'down';

    switch (direction) {
        case 'up':
            drawPlayerFacingUp(ctx, pixelSize, walkCycle, isMoving, colors);
            break;
        case 'down':
            drawPlayerFacingDown(ctx, pixelSize, walkCycle, isMoving, colors);
            break;
        case 'left':
            ctx.scale(-1, 1); // Flip horizontally for left
            reorderedDrawPlayerFacingSide(ctx, pixelSize, walkCycle, isMoving, colors);
            break;
        case 'right':
            reorderedDrawPlayerFacingSide(ctx, pixelSize, walkCycle, isMoving, colors);
            break;
    }

    // --- Equipment (drawn relative to the player) ---
    if (entity.id === state.getState().playerId) {
        const gear = state.getState().gear;
        const weaponItem = gear['weapon-slot'];
        if (weaponItem) {
            const weaponDef = itemDefinitions[weaponItem.id];
            if (weaponDef && weaponDef.asset) {
                const img = assetImages[weaponDef.asset];
                if (img) {
                    const armY = -pixelSize * 3;
                    const wepY = armY + (isMoving && walkCycle === 0 ? pixelSize : 0) + pixelSize;
                    let wepX = 0;

                    if (direction === 'down') {
                        wepX = pixelSize * 8 / 2 - pixelSize;
                    } else if (direction === 'right' || direction === 'left') {
                        wepX = -pixelSize;
                    }

                    if (direction !== 'up') { // Don't draw weapon when facing away
                        ctx.drawImage(img, wepX, wepY, tileSize * 0.75, tileSize * 0.75);
                    }
                }
            }
        }
    }

    ctx.restore();
}

function drawRatBody(ctx: CanvasRenderingContext2D, pixelSize: number, jiggle: number, tailWag: number, colors: { [key: string]: string }) {
    ctx.lineWidth = pixelSize;

    // --- Tail (drawn first) ---
    ctx.strokeStyle = colors.outlineColor;
    ctx.lineWidth = pixelSize * 2; // Fat tail outline
    ctx.beginPath();
    ctx.moveTo(0, pixelSize * 5); // Start at the back of the body
    ctx.quadraticCurveTo(
        tailWag, pixelSize * 8, // Control point sways side-to-side
        0, pixelSize * 11 // End of the tail
    );
    ctx.stroke();
    // Inner tail color
    ctx.strokeStyle = colors.noseColor; // Use same pink as nose
    ctx.lineWidth = pixelSize;
    ctx.stroke(); // Stroke again on top with a thinner line

    // --- Body ---
    ctx.lineWidth = pixelSize; // Reset for other elements
    ctx.fillStyle = colors.bodyColor;
    ctx.strokeStyle = colors.outlineColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, pixelSize * 3, pixelSize * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Ears ---
    // Left Ear
    ctx.fillStyle = colors.earColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 3, -pixelSize * 3, pixelSize * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.earInnerColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2.8, -pixelSize * 3, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Right Ear
    ctx.fillStyle = colors.earColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 3, -pixelSize * 3, pixelSize * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.earInnerColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 2.8, -pixelSize * 3, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // --- Eyes ---
    const eyeY = -pixelSize * 3;
    // Left Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-pixelSize * 1.5 + jiggle, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(-pixelSize * 1.5 + jiggle * 2, eyeY - pixelSize * 0.5, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5 + jiggle, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5 + jiggle * 2, eyeY - pixelSize * 0.5, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // --- Nose ---
    ctx.fillStyle = colors.noseColor;
    ctx.beginPath();
    ctx.arc(0, -pixelSize * 6, pixelSize * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

export function drawRat(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number) {
    ctx.imageSmoothingEnabled = false;

    const pixelSize = Math.max(1, Math.floor(tileSize / 16));
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200);
    const jiggle = isMoving ? Math.sin(time / 80) * pixelSize * 0.5 : 0;
    const tailWag = isMoving ? Math.sin(time / 150) * pixelSize * 4 : 0;

    const colors = {
        bodyColor: '#8a8a8a',
        noseColor: '#f5c5d5',
        earColor: '#d3a07c',
        earInnerColor: '#b3805c',
        outlineColor: '#333333'
    };

    let rotation = 0;
    switch (entity.direction) {
        case 'up': rotation = 0; break;
        case 'down': rotation = Math.PI; break;
        case 'left': rotation = -Math.PI / 2; break;
        case 'right': rotation = Math.PI / 2; break;
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    drawRatBody(ctx, pixelSize, jiggle, tailWag, colors);

    ctx.restore();
}
