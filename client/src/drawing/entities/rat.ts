/**
 * Rat Entity Drawing
 * 
 * Handles rendering of rat NPCs with animations and eye tracking.
 */

import { EntityState } from '../../types';
import { ANIMATION } from '../../utils/drawingConstants';
import { calculatePixelSize, isEntityMoving } from '../../utils/drawingUtils';

interface EyeState {
    lastMoveTime: number;
    eyeDirection: 'center' | 'left' | 'right';
    nextMoveDelay: number;
}
const entityEyeStates: { [id: string]: EyeState } = {};

function drawRatBody(ctx: CanvasRenderingContext2D, pixelSize: number, _jiggle: number, tailWag: number, colors: { [key: string]: string }, eyeDirection: 'center' | 'left' | 'right') {
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
    ctx.stroke(); // Stroke again on top with a thinner line

    // --- Body ---
    ctx.lineWidth = pixelSize; // Reset for other elements
    ctx.fillStyle = colors.bodyColor;
    ctx.strokeStyle = colors.outlineColor;
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
    let eyeOffsetX = 0;
    const eyeOffsetAmount = pixelSize * 0.4;
    if (eyeDirection === 'left') {
        eyeOffsetX = -eyeOffsetAmount;
    } else if (eyeDirection === 'right') {
        eyeOffsetX = eyeOffsetAmount;
    }
    // Left Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-pixelSize * 1.5, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(-pixelSize * 1.5 + eyeOffsetX, eyeY, pixelSize * 1, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(pixelSize * 1.5 + eyeOffsetX, eyeY, pixelSize * 1, 0, Math.PI * 2);
    ctx.fill();

    // --- Nose ---
    ctx.fillStyle = colors.noseColor;
    ctx.beginPath();
    ctx.arc(0, -pixelSize * 1.5, pixelSize * 1, 0, Math.PI * 2);
    ctx.fill();

    // --- Whiskers ---
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = pixelSize * 0.5;
    // Left whiskers
    ctx.beginPath();
    ctx.moveTo(-pixelSize * 2, -pixelSize);
    ctx.lineTo(-pixelSize * 4, -pixelSize * 0.5);
    ctx.moveTo(-pixelSize * 2, 0);
    ctx.lineTo(-pixelSize * 4, 0);
    ctx.moveTo(-pixelSize * 2, pixelSize);
    ctx.lineTo(-pixelSize * 4, pixelSize * 0.5);
    ctx.stroke();
    // Right whiskers
    ctx.beginPath();
    ctx.moveTo(pixelSize * 2, -pixelSize);
    ctx.lineTo(pixelSize * 4, -pixelSize * 0.5);
    ctx.moveTo(pixelSize * 2, 0);
    ctx.lineTo(pixelSize * 4, 0);
    ctx.moveTo(pixelSize * 2, pixelSize);
    ctx.lineTo(pixelSize * 4, pixelSize * 0.5);
    ctx.stroke();

    // --- Feet ---
    ctx.fillStyle = colors.outlineColor;
    ctx.fillRect(-pixelSize * 2, pixelSize * 6, pixelSize * 1.5, pixelSize);
    ctx.fillRect(pixelSize * 0.5, pixelSize * 6, pixelSize * 1.5, pixelSize);
}

export function drawRat(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number) {
    const pixelSize = calculatePixelSize(tileSize);
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = isEntityMoving(entity);
    const jiggle = isMoving ? Math.sin(time / ANIMATION.RAT_JIGGLE_SPEED) * pixelSize * ANIMATION.RAT_JIGGLE_AMOUNT : 0;
    const tailWag = isMoving ? Math.sin(time / 150) * pixelSize * 4 : 0;

    const now = Date.now();
    if (entity.id && !entityEyeStates[entity.id]) {
        entityEyeStates[entity.id] = {
            lastMoveTime: now,
            eyeDirection: 'center',
            nextMoveDelay: 2000 + Math.random() * 3000 // 2-5 seconds
        };
    }

    const eyeState = entity.id ? entityEyeStates[entity.id] : undefined;
    if (eyeState && now - eyeState.lastMoveTime > eyeState.nextMoveDelay) {
        eyeState.lastMoveTime = now;
        if (eyeState.eyeDirection !== 'center') {
            // If shifted, always go back to center
            eyeState.eyeDirection = 'center';
            eyeState.nextMoveDelay = 3000 + Math.random() * 4000; // Stay in center for 3-7 seconds
        } else {
            // If in center, occasionally shift
            if (Math.random() < 0.3) { // 30% chance to shift
                const directions: Array<'left' | 'right'> = ['left', 'right'];
                eyeState.eyeDirection = directions[Math.floor(Math.random() * directions.length)];
                eyeState.nextMoveDelay = 500 + Math.random() * 750; // Stay shifted for 0.5-1.25 seconds
            } else {
                // Stay in center, check again later
                eyeState.nextMoveDelay = 1000 + Math.random() * 2000; // Check again in 1-3 seconds
            }
        }
    }

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

    drawRatBody(ctx, pixelSize, jiggle, tailWag, colors, eyeState?.eyeDirection || 'center');

    ctx.restore();
}

