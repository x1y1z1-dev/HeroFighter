import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { DOJO } from '../data/stage';
import { UiButton } from '../ui/UiButton';

const ROWS: ReadonlyArray<[string, string, string]> = [
  ['Рух', 'A / D', '← / →'],
  ['Стрибок', 'W', '↑'],
  ['Блок', 'S', '↓'],
  ['Удар рукою', 'G', '5 / Numpad 5'],
  ['Удар ногою', 'H', '6 / Numpad 6'],
  ['Пауза', 'ESC', 'ESC'],
];

export class ControlsScene extends Phaser.Scene {
  constructor() {
    super('Controls');
  }

  create(): void {
    this.add.image(0, 0, DOJO.textureKey).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0812, 0.8).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 92, 'КЕРУВАННЯ', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '48px',
        color: '#f7f0dc',
        fontStyle: 'bold',
        stroke: '#1a1024',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const tableX = GAME_WIDTH / 2;
    const top = 210;
    const rowH = 58;

    this.add
      .text(tableX - 250, top - 54, 'ДІЯ', { fontSize: '16px', color: '#8d84a3', fontFamily: 'Verdana' })
      .setOrigin(0.5);
    this.add
      .text(tableX, top - 54, 'ГРАВЕЦЬ 1', {
        fontSize: '16px',
        color: '#f3d36a',
        fontFamily: 'Verdana',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(tableX + 250, top - 54, 'ГРАВЕЦЬ 2 / БОТ', {
        fontSize: '16px',
        color: '#7ea6e0',
        fontFamily: 'Verdana',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    ROWS.forEach(([action, p1, p2], index) => {
      const y = top + index * rowH;
      this.add.rectangle(tableX, y, 860, 44, 0x171222, index % 2 === 0 ? 0.7 : 0.35);
      this.add
        .text(tableX - 250, y, action, { fontSize: '20px', color: '#e6dfd2', fontFamily: 'Verdana' })
        .setOrigin(0.5);
      this.add
        .text(tableX, y, p1, { fontSize: '22px', color: '#f3d36a', fontFamily: 'Verdana', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.add
        .text(tableX + 250, y, p2, { fontSize: '22px', color: '#7ea6e0', fontFamily: 'Verdana', fontStyle: 'bold' })
        .setOrigin(0.5);
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        630,
        'Блок зменшує шкоду до 15%. Ближня атака — швидка, нога — повільніша, але бʼє сильніше.',
        { fontSize: '15px', color: '#9c92b0', fontFamily: 'Verdana', align: 'center', wordWrap: { width: 900 } },
      )
      .setOrigin(0.5);

    new UiButton(this, GAME_WIDTH / 2, 690, 'НАЗАД', () => this.scene.start('Menu'), {
      width: 240,
      height: 48,
      fontSize: 20,
      accent: 0x7ea6e0,
    });

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }
}
