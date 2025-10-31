/**
 * Wizard Entity Drawing
 * 
 * Handles rendering of wizard NPCs with special hat.
 */

import { COLORS } from '../../utils/drawingConstants';
import { calculatePixelSize, drawEntityShadow, lightenColor } from '../../utils/drawingUtils';
import { drawPlayerFacingDown } from './player';

export function drawWizard(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number) {
    const pixelSize = calculatePixelSize(tileSize);

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = false; // Wizards don't move
    const walkCycle = 0;

    const shirtColor = COLORS.SHIRT_WIZARD;
    const colors = {
        hairColor: COLORS.HAIR_HELMET,
        skinColor: COLORS.SKIN,
        shirtColor: shirtColor,
        pantsColor: COLORS.PANTS_WIZARD,
        shirtStripeColor: lightenColor(shirtColor, 20)
    };

    // Shadow
    drawEntityShadow(ctx, centerX, y + tileSize, pixelSize);

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

