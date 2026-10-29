import Phaser from 'phaser';

export interface Intent {
  left: boolean;
  right: boolean;
  up: boolean;
  block: boolean;
  punch: boolean;
  kick: boolean;
}

export const createIntent = (): Intent => ({
  left: false,
  right: false,
  up: false,
  block: false,
  punch: false,
  kick: false,
});

/** Every action accepts one or more physical keys (e.g. digit row + numpad). */
export type KeyBindings = Record<keyof Intent, readonly number[]>;

const KC = Phaser.Input.Keyboard.KeyCodes;

/** Player 1: WASD for movement, G / H for attacks. */
export const P1_KEYS: KeyBindings = {
  left: [KC.A],
  right: [KC.D],
  up: [KC.W],
  block: [KC.S],
  punch: [KC.G],
  kick: [KC.H],
};

/** Player 2: arrows for movement, 5 / 6 (digit row or numpad) for attacks. */
export const P2_KEYS: KeyBindings = {
  left: [KC.LEFT],
  right: [KC.RIGHT],
  up: [KC.UP],
  block: [KC.DOWN],
  punch: [KC.FIVE, KC.NUMPAD_FIVE],
  kick: [KC.SIX, KC.NUMPAD_SIX],
};

type Action = keyof Intent;
type KeyMap = Record<Action, Phaser.Input.Keyboard.Key[]>;

const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'block', 'punch', 'kick'];

export class HumanController {
  private readonly keys: KeyMap;

  constructor(scene: Phaser.Scene, bindings: KeyBindings) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is not available');

    const map = {} as KeyMap;
    for (const action of ACTIONS) {
      map[action] = bindings[action].map((code) => keyboard.addKey(code));
    }
    this.keys = map;
  }

  poll(): Intent {
    const down = (action: Action): boolean => this.keys[action].some((key) => key.isDown);
    return {
      left: down('left'),
      right: down('right'),
      up: down('up'),
      block: down('block'),
      punch: down('punch'),
      kick: down('kick'),
    };
  }
}
