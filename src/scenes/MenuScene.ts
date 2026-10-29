import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { DOJO } from '../data/stage';
import { UiButton } from '../ui/UiButton';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.image(0, 0, DOJO.textureKey).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0812, 0.66).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 150, 'HERO FIGHTER', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '96px',
        color: '#f7f0dc',
        fontStyle: 'bold',
        stroke: '#1a1024',
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setShadow(0, 8, '#000000', 12, true, true);

    this.add
      .text(GAME_WIDTH / 2, 232, 'двобій · 1 vs 1 або проти бота', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '22px',
        color: '#c9b8a6',
      })
      .setOrigin(0.5);

    new UiButton(this, GAME_WIDTH / 2, 330, '1 vs 1', () => this.scene.start('Select', { mode: 'pvp' }), {
      width: 380,
      height: 66,
      accent: 0xf3d36a,
    });

    new UiButton(this, GAME_WIDTH / 2, 412, 'ГРАВЕЦЬ ПРОТИ БОТА', () => this.scene.start('Select', { mode: 'bot' }), {
      width: 380,
      height: 66,
      accent: 0xff9f6b,
    });

    new UiButton(this, GAME_WIDTH / 2, 494, 'БОТ ПРОТИ БОТА', () => this.scene.start('Select', { mode: 'bvb' }), {
      width: 380,
      height: 66,
      accent: 0x7ee0a6,
    });

    new UiButton(this, GAME_WIDTH / 2, 576, 'КЕРУВАННЯ', () => this.scene.start('Controls'), {
      width: 380,
      height: 56,
      fontSize: 20,
      accent: 0x7ea6e0,
    });

    this.add
      .text(GAME_WIDTH / 2, 678, 'Phaser 3 · TypeScript · v0.1', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '14px',
        color: '#6d6484',
      })
      .setOrigin(0.5);
  }
}
