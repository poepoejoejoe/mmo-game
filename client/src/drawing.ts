import { TileGroup } from './grouper';
import { EntityState, WorldTile } from './types';
import { itemDefinitions } from './definitions';
import { SeededRandom } from './utils';

export function drawQuestIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, time: number, questState: EntityState['questState']) {
    const centerX = x + tileSize / 2;
    const baseY = y - tileSize * 0.4;

    // Pulsing effect for size and brightness
    const pulse = Math.sin(time / 200) * 0.05 + 0.95; // Gently pulsates between 90% and 100% size

    const indicatorHeight = tileSize * 0.7 * pulse;

    // Position oscillates up and down slightly
    const bounce = Math.sin(time / 200) * tileSize * 0.05;
    const indicatorY = baseY - bounce;

    ctx.save();
    ctx.font = `bold ${indicatorHeight}px 'Arial', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    let indicatorChar = '!';
    let indicatorColor = '#ffffff';

    switch (questState) {
        case 'available':
            indicatorColor = '#f1c40f'; // Yellow
            break;
        case 'in-progress':
            indicatorColor = '#bdc3c7'; // Grey
            break;
        case 'turn-in-ready':
            indicatorColor = '#f1c40f'; // Yellow
            indicatorChar = '?';
            break;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillText(indicatorChar, centerX + 2, indicatorY + 2);

    // Main Text
    ctx.fillStyle = indicatorColor;
    ctx.fillText(indicatorChar, centerX, indicatorY);

    ctx.restore();
}

const crackSVGs = [
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L7.5 7.5' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 M8 8 L10 9' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 M8 8 L10 9 L12 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M8 8 L7 10 L5 11 L3 9 L1 11' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e",
    "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath d='M8 8 L6 6 L7 4 L5 2 M7 4 L9 3 L11 1 M9 3 L10 5 M1 15 L4 12 M8 8 L10 9 L12 11 L14 10 M12 11 L13 13 L15 15 M14 10 L16 8 M8 8 L7 10 L5 11 L3 9 L1 11 M5 11 L4 13 M1 2 L3 4' stroke='rgba(44,62,80,0.8)' stroke-width='0.7' fill='none'/%3e%3c/svg%3e"
];

export const crackImages = crackSVGs.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

function lightenColor(hex: string, percent: number): string {
    let color = hex.startsWith('#') ? hex.slice(1) : hex;
    if (color.length === 3) {
        color = color.split('').map(char => char + char).join('');
    }

    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);

    r = Math.min(255, Math.floor(r * (1 + percent / 100)));
    g = Math.min(255, Math.floor(g * (1 + percent / 100)));
    b = Math.min(255, Math.floor(b * (1 + percent / 100)));

    const toHex = (c: number) => ('00' + c.toString(16)).slice(-2);
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function drawPath(ctx: CanvasRenderingContext2D, points: { x: number, y: number }[]) {
    if (points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

function perpendicularDistance(point: { x: number, y: number }, lineStart: { x: number, y: number }, lineEnd: { x: number, y: number }): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) {
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
    }
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    const closestX = lineStart.x + clampedT * dx;
    const closestY = lineStart.y + clampedT * dy;
    return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2));
}

export function ramerDouglasPeucker(pointList: { x: number, y: number }[], epsilon: number): { x: number, y: number }[] {
    if (pointList.length < 3) {
        return pointList;
    }
    let dmax = 0;
    let index = 0;
    const end = pointList.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(pointList[i], pointList[0], pointList[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const recResults1 = ramerDouglasPeucker(pointList.slice(0, index + 1), epsilon);
        const recResults2 = ramerDouglasPeucker(pointList.slice(index, end + 1), epsilon);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [pointList[0], pointList[end]];
    }
}

// Note: drawRockTile is simplified as neighbors are no longer needed
export function drawRockTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, _time: number, tileData: WorldTile) {
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
        const shadowShape = shape.map(p => ({ x: p.x + 2, y: p.y + 2 }));
        drawPath(ctx, shadowShape);
        ctx.fill();

        // Main rock body
        ctx.fillStyle = `rgb(${baseGray}, ${baseGray}, ${baseGray})`;
        drawPath(ctx, shape);
        ctx.fill();

        // Highlight
        const highlightGray = baseGray + 40;
        ctx.fillStyle = `rgba(${highlightGray}, ${highlightGray}, ${highlightGray}, 0.7)`;
        const highlightShape = shape.map(p => ({ x: p.x - 1 + (rand.next() - 0.5), y: p.y - 1 + (rand.next() - 0.5) }));
        drawPath(ctx, highlightShape);
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

export function drawSanctuaryStone(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, time: number) {
    const rand = new SeededRandom(tileX * 1000 + tileY);
    const centerX = x * tileSize + tileSize / 2;
    const centerY = y * tileSize + tileSize / 2;

    // --- Animation Values ---
    const floatFrequency = 1000; // Time in ms for one full up-and-down cycle
    const floatAmplitude = tileSize * 0.5; // How high it floats
    const floatOffset = (Math.sin((time + tileX * 500) / floatFrequency) + 1) / 2; // Normalized 0-1 sine wave
    const verticalOffset = -floatOffset * floatAmplitude;

    const obeliskWidth = tileSize * 0.4;
    const obeliskHeight = tileSize * 0.8;

    const baseColor = 100 + rand.nextInt(-10, 10); // Medium gray
    const highlightColor = baseColor + 40;
    const shadowColorValue = baseColor - 30;

    const mainBodyHeight = obeliskHeight * 0.7;
    const pyramidHeight = obeliskHeight * 0.3;

    // --- Base position ---
    const topY = centerY - obeliskHeight / 2 + verticalOffset;
    const leftX = centerX - obeliskWidth / 2;

    // --- Shadow ---
    const shadowY = centerY + obeliskHeight / 2;
    const shadowBaseWidth = obeliskWidth * 0.6;
    const shadowBaseHeight = obeliskWidth * 0.2;
    const shadowWidth = shadowBaseWidth + floatOffset * shadowBaseWidth * 0.5;
    const shadowHeight = shadowBaseHeight + floatOffset * shadowBaseHeight * 0.5;
    const shadowOpacity = 0.2 - floatOffset * 0.15;

    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.beginPath();
    ctx.ellipse(centerX, shadowY, shadowWidth, shadowHeight, 0, 0, 2 * Math.PI);
    ctx.fill();

    // --- Draw Main Body (3D effect) ---
    // Front Face (lighter)
    ctx.fillStyle = `rgb(${baseColor}, ${baseColor}, ${baseColor})`;
    ctx.fillRect(leftX, topY, obeliskWidth, mainBodyHeight);

    // Side Face (darker)
    const perspectiveOffset = obeliskWidth * 0.2;
    ctx.fillStyle = `rgb(${shadowColorValue}, ${shadowColorValue}, ${shadowColorValue})`;
    ctx.beginPath();
    ctx.moveTo(leftX + obeliskWidth, topY);
    ctx.lineTo(leftX + obeliskWidth + perspectiveOffset, topY - perspectiveOffset);
    ctx.lineTo(leftX + obeliskWidth + perspectiveOffset, topY + mainBodyHeight - perspectiveOffset);
    ctx.lineTo(leftX + obeliskWidth, topY + mainBodyHeight);
    ctx.closePath();
    ctx.fill();


    // --- Draw Pyramid Top (3D effect) ---
    const pyramidTopY = topY - pyramidHeight;
    // Front pyramid face
    ctx.fillStyle = `rgb(${baseColor}, ${baseColor}, ${baseColor})`;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX + obeliskWidth, topY);
    ctx.lineTo(centerX, pyramidTopY);
    ctx.closePath();
    ctx.fill();

    // Side pyramid face
    ctx.fillStyle = `rgb(${shadowColorValue}, ${shadowColorValue}, ${shadowColorValue})`;
    ctx.beginPath();
    ctx.moveTo(leftX + obeliskWidth, topY);
    ctx.lineTo(leftX + obeliskWidth + perspectiveOffset, topY - perspectiveOffset);
    ctx.lineTo(centerX, pyramidTopY);
    ctx.closePath();
    ctx.fill();
    
    // Highlight on the pyramid tip
    ctx.fillStyle = `rgba(${highlightColor}, ${highlightColor}, ${highlightColor}, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(centerX, pyramidTopY);
    ctx.lineTo(centerX - perspectiveOffset * 0.5, pyramidTopY + perspectiveOffset);
    ctx.closePath();
    ctx.fill();

    // --- Draw Runes ---
    ctx.save();
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1.0; // Increased width
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 4;   // Increased glow
    ctx.lineCap = 'round';

    const runeAreaWidth = obeliskWidth * 1;
    const runeAreaHeight = mainBodyHeight * 1;
    const runeAreaX = leftX + (obeliskWidth - runeAreaWidth) / 2;
    const runeAreaY = topY + (mainBodyHeight - runeAreaHeight) / 2;

    // Define a set of functions that draw different rune components
    const components = [
        // Spiral component
        (ctx: CanvasRenderingContext2D, area: { x: number, y: number, width: number, height: number }) => {
            ctx.beginPath();
            const centerX = area.x + area.width / 2;
            const centerY = area.y + area.height / 2;
            const maxRadius = Math.min(area.width, area.height) * (0.4 + rand.next() * 0.1); // Larger radius
            const turns = 1.5 + rand.next(); // 1.5 to 2.5 turns
            const startAngle = rand.next() * Math.PI * 2;
            const direction = rand.next() > 0.5 ? 1 : -1;

            let angle = startAngle;
            ctx.moveTo(centerX + Math.cos(angle) * maxRadius * 0.1, centerY + Math.sin(angle) * maxRadius * 0.1); // Start away from center
            for (let i = 5; i < turns * 20; i++) { // Start loop further in
                const radius = (i / (turns * 20)) * maxRadius;
                angle += direction * (Math.PI * 2) / 20;
                ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            }
            ctx.stroke();
        },
        // Horizontal lines component (can be wavy)
        (ctx: CanvasRenderingContext2D, area: { x: number, y: number, width: number, height: number }) => {
            const numLines = rand.nextInt(1, 3); // 1 or 2 lines
            const isWavy = rand.next() > 0.6;
            for (let i = 0; i < numLines; i++) {
                ctx.beginPath();
                const y = area.y + area.height * (0.25 + (i / numLines) * 0.5); // Use more of the vertical space
                const startX = area.x + area.width * 0.1;
                const endX = area.x + area.width * 0.9;
                ctx.moveTo(startX, y);
                if (isWavy) {
                    const controlY1 = y + (rand.next() - 0.5) * area.height * 0.6;
                    ctx.quadraticCurveTo((startX + endX) / 2, controlY1, endX, y);
                } else {
                    ctx.lineTo(endX, y);
                }
                ctx.stroke();
            }
        },
        // Vertical lines component (straight only for clarity)
        (ctx: CanvasRenderingContext2D, area: { x: number, y: number, width: number, height: number }) => {
            const numLines = rand.nextInt(1, 4); // 1 to 3 lines
            for (let i = 0; i < numLines; i++) {
                ctx.beginPath();
                const x = area.x + area.width * (0.2 + (i / numLines) * 0.6); // Space them out
                const startY = area.y + area.height * 0.1;
                const endY = area.y + area.height * 0.9;
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }
        },
    ];

    // --- Compose the Rune ---
    // Shuffle the available components for this specific stone
    for (let i = components.length - 1; i > 0; i--) {
        const j = rand.nextInt(0, i + 1);
        [components[i], components[j]] = [components[j], components[i]];
    }

    const numComponents = rand.nextInt(1, 3); // 1 or 2 components

    if (numComponents === 1) {
        // Draw one component in the full area
        const fullArea = {
            x: runeAreaX,
            y: runeAreaY,
            width: runeAreaWidth,
            height: runeAreaHeight,
        };
        components[0](ctx, fullArea);
    } else {
        // Asymmetrical vertical split for a dominant/minor component look
        const splitRatio = 0.3 + rand.next() * 0.2; // 30% to 50%
        
        let zone1Height = runeAreaHeight * splitRatio;
        let zone2Height = runeAreaHeight * (1 - splitRatio);
        
        // Randomly assign the larger zone to be on top or bottom
        if (rand.next() > 0.5) {
            [zone1Height, zone2Height] = [zone2Height, zone1Height];
        }

        const zone1Area = {
            x: runeAreaX,
            y: runeAreaY,
            width: runeAreaWidth,
            height: zone1Height,
        };
        components[0](ctx, zone1Area);

        const zone2Area = {
            x: runeAreaX,
            y: runeAreaY + zone1Height,
            width: runeAreaWidth,
            height: zone2Height,
        };
        components[1](ctx, zone2Area);
    }

    ctx.restore();
}

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

export function tracePerimeter(group: TileGroup): { x: number, y: number }[] {
    const tileSet = new Set(group.tiles.map(t => `${t.x},${t.y}`));
    if (group.tiles.length === 0) {
        return [];
    }
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

export function drawSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number, y: number }[]) {
    if (points.length < 3) {
        // Fallback for simple shapes
        ctx.beginPath();
        if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
        }
        ctx.closePath();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        const p_minus_1 = points[(i - 1 + points.length) % points.length];
        const p_i = points[i];
        const p_i_plus_1 = points[(i + 1) % points.length];
        const p_i_plus_2 = points[(i + 2) % points.length];

        // Catmull-Rom to Bezier conversion
        const cp1x = p_i.x + (p_i_plus_1.x - p_minus_1.x) / 6;
        const cp1y = p_i.y + (p_i_plus_1.y - p_minus_1.y) / 6;

        const cp2x = p_i_plus_1.x - (p_i_plus_2.x - p_i.x) / 6;
        const cp2y = p_i_plus_1.y - (p_i_plus_2.y - p_i.y) / 6;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p_i_plus_1.x, p_i_plus_1.y);
    }
    ctx.closePath();
}

export function drawWaterGroup(ctx: CanvasRenderingContext2D, group: TileGroup, startX: number, startY: number, tileSize: number, time: number) {
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

    const simplifiedPoints = ramerDouglasPeucker(screenPoints, tileSize * 1.2);

    const midPoints = simplifiedPoints.map((p, i) => {
        const p_next = simplifiedPoints[(i + 1) % simplifiedPoints.length];
        return {
            x: (p.x + p_next.x) / 2,
            y: (p.y + p_next.y) / 2,
        };
    });

    ctx.save();

    // --- 1. Create a smooth path for the shoreline ---
    drawSmoothPath(ctx, midPoints);

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

function drawPlayerLegs(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const legWidth = pixelSize * 3;

    // --- Legs (drawn first) ---
    ctx.fillStyle = colors.pantsColor;
    const legY = pixelSize * 2;

    // Fill gap before drawing legs
    if (isMoving) {
        ctx.fillStyle = colors.shirtColor;
        if (walkCycle === 1) { // Left leg moves down
            ctx.fillRect(-pixelSize * 4, legY, legWidth, pixelSize);
        }
        if (walkCycle === 0) { // Right leg moves down
            ctx.fillRect(pixelSize, legY, legWidth, pixelSize);
        }
        ctx.fillStyle = colors.pantsColor; // Reset for legs
    }
    
    // Left Leg
    ctx.fillRect(-pixelSize * 4, legY + (isMoving && walkCycle === 1 ? pixelSize : 0), legWidth, pixelSize * 4);
    // Right Leg
    ctx.fillRect(pixelSize, legY + (isMoving && walkCycle === 0 ? pixelSize : 0), legWidth, pixelSize * 4);
}

function drawPlayerArms(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 8;
    const armHeight = pixelSize * 5;
    // --- Arms ---
    ctx.fillStyle = colors.skinColor;
    const armY = -pixelSize * 3;
    // Left Arm
    ctx.fillRect(-torsoWidth / 2 - pixelSize * 2, armY + (isMoving && walkCycle === 0 ? pixelSize : 0), pixelSize * 2, armHeight);
    // Right Arm
    ctx.fillRect(torsoWidth / 2, armY + (isMoving && walkCycle === 1 ? pixelSize : 0), pixelSize * 2, armHeight);
}

function drawPlayerTorso(ctx: CanvasRenderingContext2D, pixelSize: number, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 8;
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);
}

function drawPlayerFacingDown(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    drawPlayerLegs(ctx, pixelSize, walkCycle, isMoving, colors);
    drawPlayerArms(ctx, pixelSize, walkCycle, isMoving, colors);
    drawPlayerTorso(ctx, pixelSize, colors);

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

function drawPlayerFacingUp(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }, tileSize: number) {
    drawPlayerLegs(ctx, pixelSize, walkCycle, isMoving, colors);
    drawPlayerTorso(ctx, pixelSize, colors);
    drawPlayerArms(ctx, pixelSize, walkCycle, isMoving, colors);
    drawPlayerWeapon(ctx, pixelSize, entity, time, assetImages, tileSize);

    // --- Head (Back) ---
    const headX = -pixelSize * 4;
    const headY = -pixelSize * 9;
    ctx.fillStyle = colors.hairColor;
    ctx.fillRect(headX - pixelSize, headY + pixelSize, pixelSize * 10, pixelSize * 8); // Full hair, no face
}

function drawPlayerFacingSide(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
    const torsoWidth = pixelSize * 4;
    const legWidth = pixelSize * 2.5;
    const armWidth = pixelSize * 2;
    const legY = pixelSize * 2;
    const armY = -pixelSize * 3;
    const legXOffset = -pixelSize * 0.5;
    const legHeight = pixelSize * 4;
    const rotationAngle = 15 * Math.PI / 180;

    // 1. Draw Far Limbs (behind torso)
    const farLegAngle = isMoving ? (walkCycle === 1 ? rotationAngle : -rotationAngle) : 0;
    ctx.save();
    ctx.fillStyle = colors.pantsColor;
    ctx.translate(-pixelSize / 2 + legXOffset + legWidth / 2, legY);
    ctx.rotate(farLegAngle);
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.restore();

    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(-armWidth / 2, armY + (isMoving && walkCycle === 0 ? -pixelSize : 0), armWidth, pixelSize * 4); // Far arm

    // 2. Draw Torso
    ctx.fillStyle = colors.shirtColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize * 4, torsoWidth, pixelSize * 6);
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(-torsoWidth / 2, -pixelSize, torsoWidth, pixelSize * 2);

    // 3. Draw Near Limbs (in front of torso)
    const nearLegAngle = isMoving ? (walkCycle === 0 ? rotationAngle : -rotationAngle) : 0;
    ctx.save();
    ctx.fillStyle = colors.pantsColor;
    ctx.translate(-pixelSize * 1.5 + legXOffset + legWidth / 2, legY);
    ctx.rotate(nearLegAngle);
    ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    ctx.restore();

    ctx.fillStyle = colors.skinColor;
    ctx.fillRect(-armWidth / 2, armY + (isMoving && walkCycle === 1 ? pixelSize : 0), armWidth, pixelSize * 4); // Near arm
    
    // 4. Draw Head
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

function drawPlayerWeapon(ctx: CanvasRenderingContext2D, pixelSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }, tileSize: number) {
    const isMoving = !!(entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200));
    const walkCycle = isMoving ? Math.floor(time / 200) % 2 : 0;
    const direction = entity.direction || 'down';

    const gear = entity.gear;
    if (!gear) return;

    const weaponItem = gear['weapon-slot'];
    if (!weaponItem) return;
    
    const weaponDef = itemDefinitions[weaponItem.id];
    if (!weaponDef) return;

    const armY = -pixelSize * 3;

    if (direction === 'up') {
        if (weaponItem.id === 'crude_axe') {
            const armHeight = pixelSize * 5;
            const handleColor = '#8B4513';
            ctx.fillStyle = handleColor;
            const handleX = pixelSize * 4;
            const handleY = armY + armHeight - pixelSize + (isMoving && walkCycle === 1 ? pixelSize : 0);
            const handleWidth = pixelSize * 2;
            const handleHeight = pixelSize * 2;
            ctx.fillRect(handleX, handleY, handleWidth, handleHeight);
        }
        return;
    }

    let wepX = 0;
    let wepY = 0;

    if (direction === 'down') {
        wepX = -10 * pixelSize; // Player's right hand is on the left of the sprite
        wepY = armY - 3 * pixelSize + (isMoving && walkCycle === 1 ? pixelSize : 0); // Sync with right arm
    } else if (direction === 'right') {
        // Player's right hand is the near arm
        wepX = 8 * pixelSize;
        wepY = armY + 2 * pixelSize + (isMoving && walkCycle === 1 ? pixelSize : 0); // Sync with near arm
    } else if (direction === 'left') {
        // On a flipped context, player's right hand is the far arm
        wepX = 7 * pixelSize;
        wepY = armY + 2 * pixelSize + (isMoving && walkCycle === 0 ? -pixelSize : 0); // Sync with far arm
    }

    if (weaponDef.draw) {
        ctx.save();
        ctx.translate(wepX, wepY);
        weaponDef.draw(ctx, pixelSize, direction);
        ctx.restore();
    } else if (weaponDef.asset) {
        const img = assetImages[weaponDef.asset];
        if (img) {
            ctx.drawImage(img, wepX, wepY, tileSize * 0.75, tileSize * 0.75);
        }
    }
}


export function drawCrudeAxe(ctx: CanvasRenderingContext2D, pixelSize: number, direction: string) {
    const handleColor = '#8B4513'; // Darker wood
    const woodGrainColor = '#A0522D'; // Lighter wood grain
    const stoneColor = '#808080'; // Medium gray for the stone
    const stoneHighlightColor = '#A9A9A9'; // Lighter gray for highlights
    const strapColor = '#6d533b'; // Brown for the straps

    ctx.save();
    
    let rotation = -Math.PI / 4.5;
    if (direction === 'right') {
        rotation = Math.PI / 2.2;
    } else if (direction === 'left') {
        rotation = Math.PI / 2.2;
    } else if (direction === 'down') {
        rotation += Math.PI;
    }
    ctx.rotate(rotation);

    if (direction === 'down') {
        ctx.scale(1, -1);
    }

    // --- Draw Handle ---
    ctx.fillStyle = handleColor;
    ctx.fillRect(0, 0, pixelSize * 2, pixelSize * 10);
    // Wood grain detail
    ctx.fillStyle = woodGrainColor;
    ctx.fillRect(pixelSize / 2, 0, pixelSize, pixelSize * 10);
    ctx.fillRect(0, pixelSize * 3, pixelSize * 2, pixelSize);
    ctx.fillRect(0, pixelSize * 6, pixelSize * 2, pixelSize / 2);


    // --- Draw Axe Head (Stone) ---
    ctx.fillStyle = stoneColor;
    ctx.beginPath();
    ctx.moveTo(-pixelSize, -pixelSize * 2); // Top back point
    ctx.lineTo(pixelSize * 3, -pixelSize * 3); // Top front point
    ctx.lineTo(pixelSize * 5, pixelSize * 2);  // Blade edge point
    ctx.lineTo(pixelSize * 3, pixelSize * 4);  // Bottom front point
    ctx.lineTo(-pixelSize, pixelSize * 3);  // Bottom back point
    ctx.closePath();
    ctx.fill();
    
    // Stone Highlight
    ctx.fillStyle = stoneHighlightColor;
    ctx.beginPath();
    ctx.moveTo(pixelSize * 3, -pixelSize * 3);
    ctx.lineTo(pixelSize * 5, pixelSize * 2);
    ctx.lineTo(pixelSize * 4, pixelSize * 2);
    ctx.lineTo(pixelSize * 2.5, -pixelSize * 2);
    ctx.closePath();
    ctx.fill();


    // --- Draw Straps ---
    ctx.fillStyle = strapColor;
    // Vertical strap part
    ctx.fillRect(-pixelSize / 2, -pixelSize, pixelSize, pixelSize * 3);
    // Horizontal strap part
    ctx.fillRect(0, 0, pixelSize * 3, pixelSize);
    
    ctx.restore();
}


export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }) {
    const pixelSize = Math.max(1, Math.floor(tileSize / 16));

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = !!(entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200));
    const walkCycle = isMoving ? Math.floor(time / 200) % 2 : 0;

    const shirtColor = entity.shirtColor || '#7b9c48';
    const colors: {[k: string]: string} = {
        hairColor: '#634b3a',
        skinColor: '#d3a07c',
        shirtColor: shirtColor,
        pantsColor: '#6d533b',
        shirtStripeColor: lightenColor(shirtColor, 20)
    };

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(centerX, y + tileSize - pixelSize * 2, pixelSize * 6, pixelSize * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
	
    if (entity.isEcho) {
        ctx.globalAlpha = 0.5;
        for (const key in colors) {
            colors[key] = lightenColor(colors[key], 50);
        }
    }

    ctx.translate(centerX, centerY);

    const direction = entity.direction || 'down';

    switch (direction) {
        case 'up':
            drawPlayerFacingUp(ctx, pixelSize, walkCycle, isMoving, colors, entity, time, assetImages, tileSize);
            break;
        case 'down':
            drawPlayerFacingDown(ctx, pixelSize, walkCycle, isMoving, colors);
            drawPlayerWeapon(ctx, pixelSize, entity, time, assetImages, tileSize);
            break;
        case 'left':
            ctx.scale(-1, 1); // Flip horizontally for left
            drawPlayerWeapon(ctx, pixelSize, entity, time, assetImages, tileSize);
            drawPlayerFacingSide(ctx, pixelSize, walkCycle, isMoving, colors);
            
            break;
        case 'right':
            drawPlayerFacingSide(ctx, pixelSize, walkCycle, isMoving, colors);
            drawPlayerWeapon(ctx, pixelSize, entity, time, assetImages, tileSize);
            break;
    }

    ctx.restore();
}

export function drawWizard(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number) {
    const pixelSize = Math.max(1, Math.floor(tileSize / 16));

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = false; // Wizards don't move
    const walkCycle = 0;

    const shirtColor = '#3498db'; // A nice blue for the wizard's robe
    const colors = {
        hairColor: '#bdc3c7', // Gray hair for an old wizard
        skinColor: '#d3a07c',
        shirtColor: shirtColor,
        pantsColor: '#2c3e50', // Dark pants
        shirtStripeColor: lightenColor(shirtColor, 20)
    };

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(centerX, y + tileSize - pixelSize * 2, pixelSize * 6, pixelSize * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);

    drawPlayerFacingDown(ctx, pixelSize, walkCycle, isMoving, colors);

    // Wizard Hat
    const headX = -pixelSize * 4;
    const headY = -pixelSize * 9;

    // Brim
    ctx.fillStyle = colors.shirtStripeColor;
    ctx.fillRect(headX - pixelSize, headY + pixelSize * 2, pixelSize * 10, pixelSize * 2);

    // Pointy part
    ctx.fillStyle = colors.shirtColor;
    ctx.beginPath();
    ctx.moveTo(headX, headY + pixelSize * 2); // Left base
    ctx.lineTo(headX + pixelSize * 8, headY + pixelSize * 2); // Right base
    ctx.lineTo(headX + pixelSize * 4, headY - pixelSize * 6); // Tip
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, _time: number, assetImages: { [key: string]: HTMLImageElement }) {
    if (!entity.itemId) return;

    const itemDef = itemDefinitions[entity.itemId] || itemDefinitions['default'];

    if (itemDef.asset) {
        const img = assetImages[itemDef.asset];
        if (img) {
            const size = tileSize * 1.00;
            const xOffset = (size - tileSize) / 2;
            const yOffset = (size - tileSize) / 2;
            ctx.drawImage(img, x - xOffset, y - yOffset, size, size);
            return;
        }
    }

    // Fallback to drawing the character
    ctx.fillStyle = itemDef.color;
    ctx.font = `${tileSize * 0.8}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemDef.character, x + tileSize / 2, y + tileSize / 2);
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
    const pixelSize = Math.max(1, Math.floor(tileSize / 16));
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = !!(entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200));
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

export function drawSlime(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, _assetImages: { [key: string]: HTMLImageElement }, props: any) {
    const pixelSize = Math.max(1, Math.floor(tileSize / 16));
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = !!(entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200));
    const wobble = isMoving ? Math.sin(time / 150) * pixelSize * 1.5 : 0;
    const stretch = isMoving ? Math.cos(time / 150) * pixelSize * 1.5 : 0;

    // --- NEW: Use color from props ---
    const baseColor = props.color || `rgba(100, 220, 120, 0.8)`;
    // Create a darker, transparent version for the outline
    const outlineR = parseInt(baseColor.slice(1, 3), 16) * 0.4;
    const outlineG = parseInt(baseColor.slice(3, 5), 16) * 0.4;
    const outlineB = parseInt(baseColor.slice(5, 7), 16) * 0.4;
    const outlineColor = `rgba(${outlineR}, ${outlineG}, ${outlineB}, 0.9)`;

    const colors = {
        bodyColor: baseColor,
        outlineColor: outlineColor,
        eyeColor: '#FFFFFF',
        pupilColor: '#000000',
    };

    ctx.save();
    ctx.translate(centerX, centerY);

    let rotation = 0;
    switch (entity.direction) {
        case 'up': rotation = 0; break;
        case 'down': rotation = Math.PI; break;
        case 'left': rotation = -Math.PI / 2; break;
        case 'right': rotation = Math.PI / 2; break;
    }
    ctx.rotate(rotation);

    // Body
    ctx.beginPath();
    ctx.ellipse(
        0,
        -pixelSize * 2 + wobble, // Jiggle up and down
        pixelSize * 6 + stretch, // Stretch horizontally
        pixelSize * 6 - stretch, // Squash vertically
        0, 0, Math.PI * 2
    );

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = colors.bodyColor;
    ctx.strokeStyle = colors.outlineColor;
    ctx.lineWidth = pixelSize;
    ctx.fill();
    ctx.stroke();

    // Reset shadow for other elements
    ctx.shadowColor = 'transparent';

    // Eyes
    const eyeY = -pixelSize * 3 + wobble;
    // Left Eye
    ctx.fillStyle = colors.eyeColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.pupilColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2.2, eyeY - pixelSize * 0.2, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.fillStyle = colors.eyeColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 2, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.pupilColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 1.8, eyeY - pixelSize * 0.2, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
