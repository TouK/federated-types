import type { WidgetProps } from './model/props';
import { renderWidget } from './internal/render';

export type { WidgetProps };

export function createWidget(props: WidgetProps) {
    return { html: renderWidget(props.label), props };
}
