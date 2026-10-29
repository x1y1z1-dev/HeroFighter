import type { Difficulty } from './config/game';

export type GameMode = 'pvp' | 'bot' | 'bvb';

export interface MatchSetup {
  mode: GameMode;
  p1: string;
  p2: string;
  difficulty: Difficulty;
}

export const isMatchSetup = (value: unknown): value is MatchSetup => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.mode === 'pvp' || v.mode === 'bot' || v.mode === 'bvb') &&
    typeof v.p1 === 'string' &&
    typeof v.p2 === 'string' &&
    typeof v.difficulty === 'string'
  );
};
