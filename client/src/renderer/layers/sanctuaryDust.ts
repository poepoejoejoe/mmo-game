/**
 * Sanctuary Dust Layer
 * 
 * Renders floating dust particles above sanctuary areas.
 */

import { TILE_SIZE } from '../../constants';
import { findSanctuaryGroups } from '../../grouper';
import { SeededRandom } from '../../utils';
import { RenderParams } from '../layers';

const sanctuaryDustCache = new Map<string, { x: number, y: number, offset: number, radius: number }[]>();

export function renderSanctuaryDust(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const startXInt = Math.floor(params.startX);
    const startYInt = Math.floor(params.startY);
    const sanctuaryGroups = findSanctuaryGroups(startXInt, startYInt, params.viewportWidthInt, params.viewportHeightInt);

    for (const group of sanctuaryGroups) {
        if (group.tiles.length === 0) continue;

        const cacheKey = `${group.tiles[0].x},${group.tiles[0].y}`;
        if (!sanctuaryDustCache.has(cacheKey)) {
            const rand = new SeededRandom(group.tiles[0].x * 1000 + group.tiles[0].y);
            const dustParticles = [];
            const numParticles = Math.max(8, Math.floor(group.tiles.length / 4));
            for (let i = 0; i < numParticles; i++) {
                const tile = group.tiles[rand.nextInt(0, group.tiles.length - 1)];
                dustParticles.push({
                    x: (tile.x + rand.next()) * TILE_SIZE, // world coords
                    y: (tile.y + rand.next()) * TILE_SIZE, // world coords
                    offset: rand.next() * 5000,
                    radius: rand.next() * 1.2 + 0.5,
                });
            }
            sanctuaryDustCache.set(cacheKey, dustParticles);
        }

        const particles = sanctuaryDustCache.get(cacheKey)!;

        if (particles) {
            for (const particle of particles) {
                const pulse = (Math.sin((params.time + particle.offset) / 2000) + 1) / 2;
                const screenX = particle.x - params.startX * TILE_SIZE;
                const screenY = particle.y - params.startY * TILE_SIZE;

                const driftX = Math.sin((params.time + particle.offset * 1.2) / 1500) * 5;
                const driftY = -(pulse * 20);

                ctx.save();
                ctx.beginPath();
                ctx.arc(
                    screenX + driftX,
                    screenY + driftY,
                    particle.radius * pulse,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.5})`;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

