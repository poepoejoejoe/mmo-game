/**
 * Rendering Layers System
 * 
 * Organizes rendering into discrete layers that can be easily added, removed, or reordered.
 * This makes it easier for LLMs to understand and modify the rendering pipeline.
 */

export interface RenderLayer {
    name: string;
    render: (ctx: CanvasRenderingContext2D, params: RenderParams) => void;
    enabled?: boolean;
    order?: number;
}

export interface RenderParams {
    startX: number;
    startY: number;
    viewportWidth: number;
    viewportHeight: number;
    viewportWidthInt: number;
    viewportHeightInt: number;
    time: number;
    canvas: HTMLCanvasElement;
}

/**
 * Layer registry - all rendering layers are registered here
 */
const layers: RenderLayer[] = [];

/**
 * Register a rendering layer
 */
export function registerLayer(layer: RenderLayer): void {
    layers.push(layer);
    // Sort by order if specified
    layers.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Get all registered layers
 */
export function getLayers(): ReadonlyArray<RenderLayer> {
    return layers;
}

/**
 * Render all layers in order
 */
export function renderLayers(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    for (const layer of layers) {
        if (layer.enabled !== false) {
            layer.render(ctx, params);
        }
    }
}

/**
 * Find a layer by name
 */
export function getLayer(name: string): RenderLayer | undefined {
    return layers.find(l => l.name === name);
}

/**
 * Enable/disable a layer
 */
export function setLayerEnabled(name: string, enabled: boolean): void {
    const layer = getLayer(name);
    if (layer) {
        layer.enabled = enabled;
    }
}

