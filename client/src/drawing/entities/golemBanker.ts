/**
 * Golem Banker Entity Drawing
 * 
 * Handles rendering of the golem banker NPC with vault door and pulsing rune.
 */

import { EntityState } from '../../types';
import { COLORS, ANIMATION, SIZE } from '../../utils/drawingConstants';
import { calculatePixelSize } from '../../utils/drawingUtils';

export function drawGolemBanker(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, _entity: EntityState, time: number, _assetImages?: { [key: string]: HTMLImageElement }, _props?: any) {
	const pixelSize = calculatePixelSize(tileSize);
	const centerX = x + tileSize / 2;
	const centerY = y + tileSize / 2;

	// Shadow
	ctx.fillStyle = COLORS.SHADOW_BLACK;
	ctx.beginPath();
	ctx.ellipse(centerX, y + tileSize - pixelSize * 2, pixelSize * 8, pixelSize * 3, 0, 0, Math.PI * 2);
	ctx.fill();

	ctx.save();
	ctx.translate(centerX, centerY);

	// Body
	const bodyWidth = pixelSize * SIZE.GOLEM_BODY_WIDTH;
	const bodyHeight = pixelSize * SIZE.GOLEM_BODY_HEIGHT;
	ctx.fillStyle = COLORS.GOLEM_BODY;
	ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);

	// Moss patches
	ctx.fillStyle = '#6B8E23';
	ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, pixelSize * 3, pixelSize * 4);
	ctx.fillRect(bodyWidth / 2 - pixelSize * 4, -bodyHeight / 2 + pixelSize * 6, pixelSize * 4, pixelSize * 3);
	ctx.fillRect(-bodyWidth / 2 + pixelSize * 2, bodyHeight / 2 - pixelSize * 3, pixelSize * 5, pixelSize * 3);

	// Rune
	const pulse = Math.sin(time / ANIMATION.GOLEM_RUNE_PULSE_SPEED) * 0.2 + 0.8;
	ctx.fillStyle = `${COLORS.GOLEM_RUNE}${pulse})`;
	ctx.font = `bold ${pixelSize * SIZE.GOLEM_RUNE_FONT_SIZE}px monospace`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('B', 0, -pixelSize * 2); // Simple 'B' for Bank

	// Vault door
	ctx.fillStyle = COLORS.GOLEM_VAULT_DOOR;
	ctx.fillRect(-pixelSize * SIZE.GOLEM_VAULT_DOOR_WIDTH / 2, pixelSize, pixelSize * SIZE.GOLEM_VAULT_DOOR_WIDTH, pixelSize * SIZE.GOLEM_VAULT_DOOR_HEIGHT);
	ctx.fillStyle = COLORS.GOLEM_VAULT_DETAIL;
	ctx.fillRect(-pixelSize * SIZE.GOLEM_VAULT_DETAIL_WIDTH / 2, pixelSize * 2, pixelSize * SIZE.GOLEM_VAULT_DETAIL_WIDTH, pixelSize * SIZE.GOLEM_VAULT_DETAIL_HEIGHT);

	ctx.restore();
}

