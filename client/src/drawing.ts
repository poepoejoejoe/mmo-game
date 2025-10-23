import { TileGroup } from './grouper';

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
