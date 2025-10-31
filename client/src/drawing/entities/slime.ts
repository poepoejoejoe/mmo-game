/**
 * Slime Entity Drawing
 * 
 * Handles rendering of slime NPCs with wobble animations and eye tracking.
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

export function drawSlime(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, _assetImages: { [key: string]: HTMLImageElement }, props: any) {
    const pixelSize = calculatePixelSize(tileSize);
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = isEntityMoving(entity);
    const wobble = isMoving ? Math.sin(time / ANIMATION.SLIME_WOBBLE_SPEED) * pixelSize * ANIMATION.SLIME_WOBBLE_AMOUNT : 0;
    const stretch = isMoving ? Math.cos(time / ANIMATION.SLIME_STRETCH_SPEED) * pixelSize * ANIMATION.SLIME_STRETCH_AMOUNT : 0;

    const now = Date.now();
    if (entity.id && !entityEyeStates[entity.id]) {
        entityEyeStates[entity.id] = {
            lastMoveTime: now,
            eyeDirection: 'center',
            nextMoveDelay: 2000 + Math.random() * 3000
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

    let eyeOffsetX = 0;
    const eyeOffsetAmount = pixelSize * 0.4;
    if (eyeState && eyeState.eyeDirection === 'left') {
        eyeOffsetX = -eyeOffsetAmount;
    } else if (eyeState && eyeState.eyeDirection === 'right') {
        eyeOffsetX = eyeOffsetAmount;
    }

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

    // Reset shadow for other elements
    ctx.shadowColor = 'transparent';

    // Eyes
    const eyeY = -pixelSize * 3 + wobble;
    // Left Eye
    ctx.fillStyle = colors.eyeColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = pixelSize * 0.5;
    ctx.stroke();
    ctx.fillStyle = colors.pupilColor;
    ctx.beginPath();
    ctx.arc(-pixelSize * 2 + eyeOffsetX, eyeY - pixelSize * 0.2, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Right Eye
    ctx.fillStyle = colors.eyeColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 2, eyeY, pixelSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = pixelSize * 0.5;
    ctx.stroke();
    ctx.fillStyle = colors.pupilColor;
    ctx.beginPath();
    ctx.arc(pixelSize * 2 + eyeOffsetX, eyeY - pixelSize * 0.2, pixelSize * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

