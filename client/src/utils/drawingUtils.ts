/**
 * Drawing Utility Functions
 * 
 * Reusable utility functions for drawing operations.
 * These make it easier to maintain consistent styling and reduce code duplication.
 */

import { COLORS, RATIOS, SIZE, OPACITY } from './drawingConstants';

/**
 * Lightens a hex color by a given percentage
 */
export function lightenColor(hex: string, percent: number): string {
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

/**
 * Calculates pixel size from tile size (used for pixel art drawing)
 */
export function calculatePixelSize(tileSize: number): number {
    return Math.max(1, Math.floor(tileSize / SIZE.PIXEL_SIZE_DIVISOR));
}

/**
 * Draws a shadow ellipse below an entity
 */
export function drawEntityShadow(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    bottomY: number,
    pixelSize: number,
    opacity: number = OPACITY.SHADOW_LIGHT
): void {
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.beginPath();
    ctx.ellipse(
        centerX,
        bottomY - pixelSize * SIZE.SHADOW_Y_OFFSET,
        pixelSize * SIZE.SHADOW_WIDTH_MULTIPLIER,
        pixelSize * SIZE.SHADOW_HEIGHT_MULTIPLIER,
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

/**
 * Calculates walk cycle frame (0 or 1) based on time and movement state
 */
export function calculateWalkCycle(time: number, isMoving: boolean): number {
    return isMoving ? Math.floor(time / 200) % 2 : 0;
}

/**
 * Checks if an entity is currently moving based on lastMoveTime
 */
export function isEntityMoving(entity: { lastMoveTime?: number }): boolean {
    return !!(entity.lastMoveTime && (Date.now() - entity.lastMoveTime < 200));
}

/**
 * Applies echo effect to colors (lightens them)
 */
export function applyEchoEffect(colors: { [key: string]: string }): { [key: string]: string } {
    const echoColors: { [key: string]: string } = {};
    for (const key in colors) {
        echoColors[key] = lightenColor(colors[key], RATIOS.COLOR_LIGHTEN_ECHO);
    }
    return echoColors;
}

