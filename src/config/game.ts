export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Arcade-physics tuning shared by every fighter. */
export const PHYSICS = {
  gravityY: 1600,
  worldBoundsPad: 0,
} as const;

/** Match rules. */
export const RULES = {
  maxHealth: 100,
  roundTimeMs: 60_000,
  roundsToWin: 2,
  maxRounds: 3,
  introMs: 1500,
  roundEndMs: 2200,
  matchEndMs: 900,
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface BotProfile {
  id: Difficulty;
  label: string;
  /** How long the bot waits before re-evaluating the situation. */
  thinkMs: number;
  /** Chance to pick an attack when in range. */
  aggression: number;
  /** Chance to guard against an incoming attack. */
  blockChance: number;
  /** Chance to back off instead of pressing forward. */
  retreatChance: number;
  /** Chance to jump as an approach option. */
  jumpChance: number;
  /** Chance to do something plainly wrong (human-like). */
  mistakeChance: number;
}

export const BOT_PROFILES: Record<Difficulty, BotProfile> = {
  easy: {
    id: 'easy',
    label: 'Легкий',
    thinkMs: 340,
    aggression: 0.3,
    blockChance: 0.25,
    retreatChance: 0.25,
    jumpChance: 0.05,
    mistakeChance: 0.35,
  },
  normal: {
    id: 'normal',
    label: 'Середній',
    thinkMs: 210,
    aggression: 0.5,
    blockChance: 0.45,
    retreatChance: 0.2,
    jumpChance: 0.1,
    mistakeChance: 0.15,
  },
  hard: {
    id: 'hard',
    label: 'Складний',
    thinkMs: 110,
    aggression: 0.72,
    blockChance: 0.7,
    retreatChance: 0.14,
    jumpChance: 0.14,
    mistakeChance: 0.04,
  },
};
