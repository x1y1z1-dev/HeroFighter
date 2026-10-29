import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { FRAME_SIZE, registerAnimations } from '../data/animations';
import { CHARACTERS } from '../data/characters';
import { DOJO } from '../data/stage';
import { assetUrl } from '../utils/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 90, 'HERO FIGHTER', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '58px',
        color: '#f4eee0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, cy + 24, 428, 20, 0x1c1728).setStrokeStyle(2, 0x3b3350);
    const bar = this.add.rectangle(cx - 208, cy + 24, 4, 14, 0xf3d36a).setOrigin(0, 0.5);
    const percent = this.add
      .text(cx, cy + 64, '0%', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '16px',
        color: '#8d84a3',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.width = Math.max(4, 416 * value);
      percent.setText(`${Math.round(value * 100)}%`);
    });

    for (const character of CHARACTERS) {
      this.load.spritesheet(character.id, assetUrl(`sprites/${character.id}.png`), {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
    }
    this.load.image(DOJO.textureKey, assetUrl('stage/dojo.png'));
  }

  create(): void {
    registerAnimations(this);
    this.scene.start('Menu');
  }
}
