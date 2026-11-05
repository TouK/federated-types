import './globals';

export interface RenderInternals {
    cache: Map<string, string>;
}

export function renderWidget(label: string): string {
    return `<div>${label}</div>`;
}
