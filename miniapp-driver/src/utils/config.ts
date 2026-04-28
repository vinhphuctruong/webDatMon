export function getConfig<T>(getter: (config: any) => T): T {
  const config = (window as any).APP_CONFIG;
  return getter(config);
}
