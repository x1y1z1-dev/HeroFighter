export interface PlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageDef {
  textureKey: string;
  width: number;
  height: number;
  /** Y coordinate of the walkable floor (top edge). */
  groundY: number;
  platforms: PlatformDef[];
  spawn: { p1: number; p2: number };
}

/**
 * Geometry must match the artwork produced by tools/gen-assets.mjs.
 */
export const DOJO: StageDef = {
  textureKey: 'stage-dojo',
  width: 1280,
  height: 720,
  groundY: 600,
  platforms: [
    { x: 150, y: 452, width: 260, height: 22 },
    { x: 870, y: 452, width: 260, height: 22 },
    { x: 520, y: 352, width: 240, height: 22 },
  ],
  spawn: { p1: 380, p2: 900 },
};
