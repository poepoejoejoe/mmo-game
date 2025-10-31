/**
 * Background Layer
 * 
 * Renders the grass texture background that tiles across the world.
 */

import { BACKGROUND_TILE_SIZE, TILE_SIZE } from '../../constants';
import { assetImages } from '../../renderer';
import { RenderParams } from '../layers';

export function renderBackground(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const bgImage = assetImages['assets/grass-texture.png'];
    if (!bgImage) {
        // Fallback for when image not loaded yet
        ctx.fillStyle = '#6B8E23'; // ground color
        ctx.fillRect(0, 0, params.canvas.width, params.canvas.height);
        return;
    }

    // Create a temporary canvas to draw the scaled-down pattern
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = BACKGROUND_TILE_SIZE;
    tempCanvas.height = BACKGROUND_TILE_SIZE;

    // Draw the grass texture onto the temporary canvas at the desired size
    tempCtx.drawImage(bgImage, 0, 0, BACKGROUND_TILE_SIZE, BACKGROUND_TILE_SIZE);

    const pattern = ctx.createPattern(tempCanvas, 'repeat');
    if (pattern) {
        ctx.fillStyle = pattern;
        ctx.save();
        
        const pixelOffsetX = params.startX * TILE_SIZE;
        const pixelOffsetY = params.startY * TILE_SIZE;
        
        ctx.translate(-pixelOffsetX, -pixelOffsetY);
        ctx.fillRect(pixelOffsetX, pixelOffsetY, params.canvas.width, params.canvas.height);
        
        ctx.restore();
    }
}

