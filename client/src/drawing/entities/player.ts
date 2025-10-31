/**
 * Player Entity Drawing
 * 
 * Handles rendering of player characters with direction-based sprites,
 * walking animations, gear, and weapons.
 */

import { EntityState } from '../../types';
import { COLORS, OPACITY, SIZE } from '../../utils/drawingConstants';
import { calculatePixelSize, drawEntityShadow, isEntityMoving, calculateWalkCycle, lightenColor, applyEchoEffect } from '../../utils/drawingUtils';
import { itemDefinitions } from '../../definitions';

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

export function drawPlayerFacingDown(ctx: CanvasRenderingContext2D, pixelSize: number, walkCycle: number, isMoving: boolean, colors: { [key: string]: string }) {
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
            ctx.fillStyle = COLORS.HANDLE;
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
            ctx.drawImage(img, wepX, wepY, tileSize * SIZE.WEAPON_SIZE_MULTIPLIER, tileSize * SIZE.WEAPON_SIZE_MULTIPLIER);
        }
    }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, time: number, assetImages: { [key: string]: HTMLImageElement }) {
    const pixelSize = calculatePixelSize(tileSize);

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    const isMoving = isEntityMoving(entity);
    const walkCycle = calculateWalkCycle(time, isMoving);

    const shirtColor = entity.shirtColor || COLORS.SHIRT_DEFAULT;
    const colors: {[k: string]: string} = {
        hairColor: COLORS.HAIR_DEFAULT,
        skinColor: COLORS.SKIN,
        shirtColor: shirtColor,
        pantsColor: COLORS.PANTS,
        shirtStripeColor: lightenColor(shirtColor, 20)
    };

    if (entity.gear && entity.gear['head-slot'] && entity.gear['head-slot'].id === 'iron_helmet') {
        colors.hairColor = COLORS.HAIR_HELMET;
    }

    // Shadow
    drawEntityShadow(ctx, centerX, y + tileSize, pixelSize);

    ctx.save();
	
    if (entity.isEcho) {
        ctx.globalAlpha = OPACITY.ECHO;
        Object.assign(colors, applyEchoEffect(colors));
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

