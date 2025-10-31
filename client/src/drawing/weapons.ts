/**
 * Weapon Drawing
 * 
 * Handles rendering of weapons held by players.
 */

import { COLORS } from '../utils/drawingConstants';

export function drawCrudeAxe(ctx: CanvasRenderingContext2D, pixelSize: number, direction: string) {
    const handleColor = COLORS.HANDLE;
    const woodGrainColor = COLORS.WOOD_GRAIN;
    const stoneColor = COLORS.STONE;
    const stoneHighlightColor = COLORS.STONE_HIGHLIGHT;
    const strapColor = COLORS.STRAP;

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

