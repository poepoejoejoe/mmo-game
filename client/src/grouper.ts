import * as state from './state';

export interface TileGroup {
    type: string;
    tiles: { x: number, y: number }[];
}

export function findTileGroups(startX: number, startY: number, width: number, height: number): TileGroup[] {
    const groups: TileGroup[] = [];
    const visited = new Set<string>();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const worldX = startX + x;
            const worldY = startY + y;
            const coordKey = `${worldX},${worldY}`;

            if (visited.has(coordKey)) {
                continue;
            }

            const tile = state.getTileData(worldX, worldY);
            if (tile.type === 'ground' || tile.type === 'void') {
                visited.add(coordKey);
                continue;
            }

            const group: TileGroup = {
                type: tile.type,
                tiles: [],
            };

            const queue = [{ x: worldX, y: worldY }];
            visited.add(coordKey);
            let head = 0;

            while(head < queue.length) {
                const current = queue[head++];
                group.tiles.push({ x: current.x, y: current.y });

                const neighbors = [
                    { x: current.x, y: current.y - 1 }, // N
                    { x: current.x, y: current.y + 1 }, // S
                    { x: current.x + 1, y: current.y }, // E
                    { x: current.x - 1, y: current.y }, // W
                ];

                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(neighborKey) && state.getTileData(neighbor.x, neighbor.y).type === tile.type) {
                        visited.add(neighborKey);
                        queue.push(neighbor);
                    }
                }
            }
            groups.push(group);
        }
    }

    return groups;
}

export function findSanctuaryGroups(startX: number, startY: number, width: number, height: number): TileGroup[] {
    const groups: TileGroup[] = [];
    const visited = new Set<string>();

    for (let y = startY; y < startY + height; y++) {
        for (let x = startX; x < startX + width; x++) {
            const coordKey = `${x},${y}`;
            if (visited.has(coordKey)) {
                continue;
            }

            const tile = state.getTileData(x, y);
            if (!tile.isSanctuary) {
                visited.add(coordKey);
                continue;
            }

            const group: TileGroup = {
                type: 'sanctuary',
                tiles: [],
            };

            const queue = [{ x, y }];
            visited.add(coordKey);
            let head = 0;

            while(head < queue.length) {
                const current = queue[head++];
                group.tiles.push({ x: current.x, y: current.y });

                const neighbors = [
                    { x: current.x, y: current.y - 1 }, // N
                    { x: current.x, y: current.y + 1 }, // S
                    { x: current.x + 1, y: current.y }, // E
                    { x: current.x - 1, y: current.y }, // W
                ];

                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(neighborKey) && state.getTileData(neighbor.x, neighbor.y).isSanctuary) {
                        visited.add(neighborKey);
                        queue.push(neighbor);
                    }
                }
            }
            if (group.tiles.length > 0) {
                groups.push(group);
            }
        }
    }

    return groups;
}