/// <reference types="vite/client" />
declare module 'virtual:catalog' {
  import type { Catalog } from './lib/types';
  const catalog: Catalog;
  export default catalog;
}
declare module '@fontsource-variable/geist';
declare module '@fontsource-variable/geist-mono';
