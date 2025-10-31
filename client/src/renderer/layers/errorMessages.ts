/**
 * Error Messages Module
 * 
 * Manages error messages that are displayed via React component.
 * This module provides the interface for adding error messages.
 */

// Legacy support - expose showErrorMessage for network.ts
// The actual rendering is handled by ErrorMessages React component
export function showErrorMessage(message: string) {
    // Call the React component via window API
    const showErrorMessageFn = (window as any).showErrorMessage;
    if (showErrorMessageFn) {
        showErrorMessageFn(message);
    } else {
        console.warn('showErrorMessage function not registered yet');
    }
}

// Legacy export for renderer - this will be removed once we remove the layer
export function renderErrorMessages(_ctx: CanvasRenderingContext2D, _params: any): void {
    // No-op - rendering is now handled by React component
}
