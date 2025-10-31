/**
 * Sanctuary Stone Tile Drawing
 * 
 * Draws a floating obelisk with animated runes and glowing cyan effects.
 */

import { SeededRandom } from '../../utils';
import { SIZE } from '../../utils/drawingConstants';

export function drawSanctuaryStone(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileX: number, tileY: number, time: number) {
    const rand = new SeededRandom(tileX * 1000 + tileY);
    const centerX = x * tileSize + tileSize / 2;
    const centerY = y * tileSize + tileSize / 2;

    // --- Animation Values ---
    const floatFrequency = 1000; // Time in ms for one full up-and-down cycle
    const floatAmplitude = tileSize * 0.5; // How high it floats
    const floatOffset = (Math.sin((time + tileX * 500) / floatFrequency) + 1) / 2; // Normalized 0-1 sine wave
    const verticalOffset = -floatOffset * floatAmplitude;

    const obeliskWidth = tileSize * SIZE.SANCTUARY_OBELISK_WIDTH;
    const obeliskHeight = tileSize * SIZE.SANCTUARY_OBELISK_HEIGHT;

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

