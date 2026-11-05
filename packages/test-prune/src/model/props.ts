import type { HelperConfig } from '../../../test-inline/src/utils/helper';
import type { Theme } from './theme';

export interface WidgetProps {
    label: string;
    theme?: Theme;
    // sources from outside of this package move tsc's common source directory up
    helper?: HelperConfig;
}
