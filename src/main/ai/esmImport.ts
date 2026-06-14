/** Native dynamic import from CommonJS (TS would otherwise emit require() for import()). */
export function importEsm<T = unknown>(specifier: string): Promise<T> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<T>;
  return dynamicImport(specifier);
}
