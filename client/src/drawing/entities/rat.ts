/**
 * Rat Entity Drawing
 * 
 * Handles rendering of rat NPCs with animations and eye tracking.
 */

import { EntityState } from '../../types';

function drawRatBody(ctx: CanvasRenderingContext2D, pixelSize: number, jiggle: number, tailWag: number, colors: { [key: string]: string }) {
    ctx.lineWidth = pixelSize;

    // --- Tail (drawn first) ---
    ctx.beginPath();
    ctx.moveTo(0, pixelSize * 5); // Start at the back of the body
    ctx.quadraticCurveTo(
        tailWag, pixelSize * 8, // Control point sways side-to-side
        0, pixelSize * 11 // End of the tail
    );
    // Inner tail color
    ctx.strokeStyle = colors.noseColor; // Use same pink as nose
    ctx.lineWidth = pixelSize;
    ctx.stroke(); // This is the tail, not an outline

    // --- Body ---
    ctx.lineWidth = pixelSize; // Reset for other elements
    ctx.fillStyle = colors.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, pixelSize * 3, pixelSize * 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Ears ---
    // Left Ear
    ctx.fillStyle = colors.earColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 3, -pixelSize * 3, pixelSize * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.earInnerColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2.8, -pixelSize * 3, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Right Ear
    ctx.fillStyle = colors.earColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 3, -pixelSize * 3, pixelSize * 2.5, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(-pixelSize * 1.5 + jiggle * 2, eyeY - pixelSize * 0.5, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5 + jiggle, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5 + jiggle * 2, eyeY - pixelSize * 0.5, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // --- Nose ---
    ctx.fillStyle = colors.noseColor;
    ctx.beginPath();
    ctx.arc(0, -pixelSize * 6, pixelSize * 1.8, 0, Math.PI * 2);
    ctx.fill();
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
