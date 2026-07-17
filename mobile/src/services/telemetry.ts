type Properties = Record<string, boolean | number | string | null | undefined>;

export const telemetry = {
  capture(event: string, properties?: Properties) {
    if (__DEV__) console.info(`[DealUp event] ${event}`, properties ?? {});
  },
  screen(name: string) {
    if (__DEV__) console.info(`[DealUp screen] ${name}`);
  },
};
