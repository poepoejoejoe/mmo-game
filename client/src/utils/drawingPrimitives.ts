/**
 * Drawing Primitives Library
 * 
 * Common drawing operations used across entity and tile rendering.
 * These functions encapsulate common patterns to reduce code duplication
 * and make it easier to add new drawing features.
 */

import { COLORS, SIZE, OPACITY } from './drawingConstants';
import { calculatePixelSize, drawEntityShadow } from './drawingUtils';

/**
 * Draw a filled rectangle with optional shadow
 */
export function drawRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fillStyle: string,
    strokeStyle?: string,
    lineWidth?: number
): void {
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
    }
    if (lineWidth !== undefined) {
        ctx.lineWidth = lineWidth;
    }
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);
    if (strokeStyle) {
        ctx.strokeRect(x, y, width, height);
    }
}

/**
 * Draw a filled circle/ellipse
 */
export function drawCircle(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    fillStyle: string,
    strokeStyle?: string,
    lineWidth?: number,
    rotation?: number
): void {
    ctx.save();
    if (rotation) {
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
    }
    
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        if (lineWidth !== undefined) {
            ctx.lineWidth = lineWidth;
        }
        ctx.stroke();
    }
    
    ctx.restore();
}

/**
 * Draw a path from points
 */
export function drawPath(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    closePath: boolean = false
): void {
    if (points.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    if (closePath) {
        ctx.closePath();
    }
}

/**
 * Draw a quadratic curve (for tails, etc.)
 */
export function drawQuadraticCurve(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    controlX: number,
    controlY: number,
    endX: number,
    endY: number,
    strokeStyle: string,
    lineWidth: number
): void {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

/**
 * Draw entity shadow (re-exported for convenience)
 */
export { drawEntityShadow };

/**
 * Draw text with optional shadow
 */
export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
        fillStyle?: string;
        strokeStyle?: string;
        fontSize?: number;
        fontFamily?: string;
        textAlign?: CanvasTextAlign;
        textBaseline?: CanvasTextBaseline;
        shadow?: boolean;
        shadowOffsetX?: number;
        shadowOffsetY?: number;
        shadowColor?: string;
        shadowBlur?: number;
    } = {}
): void {
    const {
        fillStyle = COLORS.TEXT_WHITE,
        strokeStyle,
        fontSize = 12,
        fontFamily = 'Arial',
        textAlign = 'left',
        textBaseline = 'top',
        shadow = false,
        shadowOffsetX = 2,
        shadowOffsetY = 2,
        shadowColor = COLORS.SHADOW_BLACK_DARKER,
        shadowBlur = 0,
    } = options;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    if (shadow) {
        ctx.fillStyle = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.fillText(text, x + shadowOffsetX, y + shadowOffsetY);
    }

    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);

    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.strokeText(text, x, y);
    }

    ctx.restore();
}

/**
 * Draw an arc (for partial circles)
 */
export function drawArc(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    fillStyle?: string,
    strokeStyle?: string,
    lineWidth?: number,
    counterclockwise?: boolean
): void {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, counterclockwise);
    
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        if (lineWidth !== undefined) {
            ctx.lineWidth = lineWidth;
        }
        ctx.stroke();
    }
}

/**
 * Draw a gradient-filled shape
 */
export function drawGradientRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    gradient: {
        type: 'linear' | 'radial';
        colors: { offset: number; color: string }[];
        x0?: number;
        y0?: number;
        x1?: number;
        y1?: number;
        r0?: number;
        r1?: number;
    }
): void {
    let grad: CanvasGradient;
    
    if (gradient.type === 'linear') {
        grad = ctx.createLinearGradient(
            gradient.x0 ?? x,
            gradient.y0 ?? y,
            gradient.x1 ?? x + width,
            gradient.y1 ?? y + height
        );
    } else {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        grad = ctx.createRadialGradient(
            centerX,
            centerY,
            gradient.r0 ?? 0,
            centerX,
            centerY,
            gradient.r1 ?? Math.max(width, height) / 2
        );
    }
    
    for (const stop of gradient.colors) {
        grad.addColorStop(stop.offset, stop.color);
    }
    
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
}

/**
 * Apply a shadow effect
 */
export function setShadow(
    ctx: CanvasRenderingContext2D,
    options: {
        color?: string;
        blur?: number;
        offsetX?: number;
        offsetY?: number;
    }
): void {
    const {
        color = COLORS.SHADOW_BLACK,
        blur = 0,
        offsetX = 0,
        offsetY = 0,
    } = options;

    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = offsetX;
    ctx.shadowOffsetY = offsetY;
}

/**
 * Clear shadow effects
 */
export function clearShadow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Draw a polygon from points
 */
export function drawPolygon(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    fillStyle?: string,
    strokeStyle?: string,
    lineWidth?: number
): void {
    if (points.length < 3) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        if (lineWidth !== undefined) {
            ctx.lineWidth = lineWidth;
        }
        ctx.stroke();
    }
}

