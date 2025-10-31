/**
 * Damage Indicators Layer
 * 
 * Renders floating damage numbers above entities.
 */

import { TILE_SIZE } from '../../constants';
import { RenderParams } from '../layers';

const DAMAGE_INDICATOR_LIFETIME = 1000; // 1 second

interface DamageIndicator {
    text: string;
    x: number;
    y: number;
    life: number; // Time in ms until it disappears
}

export const damageIndicators: DamageIndicator[] = [];

export function showDamageIndicator(x: number, y: number, damage: number) {
    damageIndicators.push({
        text: `-${damage}`,
        x: x,
        y: y,
        life: Date.now() + DAMAGE_INDICATOR_LIFETIME,
    });
}

export function renderDamageIndicators(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const now = Date.now();
    ctx.font = "bold 16px 'Roboto', sans-serif";
    ctx.textAlign = 'center';

    for (let i = damageIndicators.length - 1; i >= 0; i--) {
        const indicator = damageIndicators[i];

        if (now > indicator.life) {
            damageIndicators.splice(i, 1);
            continue;
        }

        const remainingLife = indicator.life - now;
        const fadeAlpha = Math.min(1, remainingLife / DAMAGE_INDICATOR_LIFETIME);
        const yOffset = (1 - (remainingLife / DAMAGE_INDICATOR_LIFETIME)) * TILE_SIZE;

        const screenX = (indicator.x - params.startX) * TILE_SIZE + TILE_SIZE / 2;
        const screenY = (indicator.y - params.startY) * TILE_SIZE - yOffset;

        ctx.fillStyle = `rgba(231, 76, 60, ${fadeAlpha})`;
        ctx.fillText(indicator.text, screenX, screenY);
    }
}

