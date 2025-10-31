/**
 * Path Utilities
 * 
 * Utility functions for drawing paths and geometric calculations.
 */

/**
 * Draw a closed path from an array of points
 */
export function drawPath(ctx: CanvasRenderingContext2D, points: { x: number, y: number }[]): void {
    if (points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
export function perpendicularDistance(point: { x: number, y: number }, lineStart: { x: number, y: number }, lineEnd: { x: number, y: number }): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) {
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
    }
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    const closestX = lineStart.x + clampedT * dx;
    const closestY = lineStart.y + clampedT * dy;
    return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2));
}

/**
 * Simplify a path using the Ramer-Douglas-Peucker algorithm
 */
export function ramerDouglasPeucker(pointList: { x: number, y: number }[], epsilon: number): { x: number, y: number }[] {
    if (pointList.length < 3) {
        return pointList;
    }
    let dmax = 0;
    let index = 0;
    const end = pointList.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(pointList[i], pointList[0], pointList[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const recResults1 = ramerDouglasPeucker(pointList.slice(0, index + 1), epsilon);
        const recResults2 = ramerDouglasPeucker(pointList.slice(index, end + 1), epsilon);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [pointList[0], pointList[end]];
    }
}

/**
 * Draw a smooth path using Catmull-Rom splines converted to Bezier curves
 */
export function drawSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number, y: number }[]): void {
    if (points.length < 3) {
        // Fallback for simple shapes
        ctx.beginPath();
        if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
        }
        ctx.closePath();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        const p_minus_1 = points[(i - 1 + points.length) % points.length];
        const p_i = points[i];
        const p_i_plus_1 = points[(i + 1) % points.length];
        const p_i_plus_2 = points[(i + 2) % points.length];

        // Catmull-Rom to Bezier conversion
        const cp1x = p_i.x + (p_i_plus_1.x - p_minus_1.x) / 6;
        const cp1y = p_i.y + (p_i_plus_1.y - p_minus_1.y) / 6;

        const cp2x = p_i_plus_1.x - (p_i_plus_2.x - p_i.x) / 6;
        const cp2y = p_i_plus_1.y - (p_i_plus_2.y - p_i.y) / 6;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p_i_plus_1.x, p_i_plus_1.y);
    }
    ctx.closePath();
}

