export interface HelperConfig {
    enabled: boolean;
    timeout: number;
}

export function createHelper(config: HelperConfig): string {
    return `Helper configured with timeout: ${config.timeout}`;
}

export const defaultConfig: HelperConfig = {
    enabled: true,
    timeout: 5000,
};
