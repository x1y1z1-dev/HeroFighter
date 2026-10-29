import Phaser from 'phaser';
import { CHARACTERS } from './characters';

/** Sprite sheets are 8 x 3 frames of 192 px (see docs/SPRITES.md). */
export const FRAME_SIZE = 192;

export const FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  jump: [10, 11],
  punch: [12, 13, 14],
  kick: [15, 16, 17],
  hit: [18, 19],
  block: [20, 21],
  ko: [22],
} as const;

export type AnimationState = keyof typeof FRAMES;

const SPECS: ReadonlyArray<{
  state: AnimationState;
  frameRate: number;
  repeat: number;
}> = [
  { state: 'idle', frameRate: 6, repeat: -1 },
  { state: 'walk', frameRate: 12, repeat: -1 },
  { state: 'jump', frameRate: 8, repeat: 0 },
  { state: 'punch', frameRate: 16, repeat: 0 },
  { state: 'kick', frameRate: 13, repeat: 0 },
  { state: 'hit', frameRate: 10, repeat: 0 },
  { state: 'block', frameRate: 5, repeat: 0 },
  { state: 'ko', frameRate: 1, repeat: 0 },
];

export const animKey = (characterId: string, state: AnimationState): string => `${characterId}-${state}`;

export const registerAnimations = (scene: Phaser.Scene): void => {
  for (const character of CHARACTERS) {
    for (const spec of SPECS) {
      const key = animKey(character.id, spec.state);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: FRAMES[spec.state].map((frame) => ({ key: character.id, frame })),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }
};
