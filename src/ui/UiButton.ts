import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  accent?: number;
  fill?: number;
  enabled?: boolean;
}

export class UiButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly accent: number;
  private enabled: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    options: ButtonOptions = {},
  ) {
    super(scene, x, y);

    const width = options.width ?? 340;
    const height = options.height ?? 66;
    const accent = options.accent ?? 0xf3d36a;

    this.accent = accent;
    this.enabled = options.enabled ?? true;

    this.bg = scene.add.rectangle(0, 0, width, height, options.fill ?? 0x1b1626, 0.92);
    this.bg.setStrokeStyle(2, accent, 1);

    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: `${options.fontSize ?? 26}px`,
        color: '#f4eee0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add([this.bg, this.label]);
    this.setSize(width, height);
    // Container hit areas are measured from the top-left (Phaser adds displayOrigin),
    // so this rectangle must NOT be centred on 0,0.
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

    this.on('pointerover', () => {
      if (!this.enabled) return;
      this.bg.setFillStyle(0x2b2340, 1);
      scene.tweens.add({ targets: this, scale: 1.04, duration: 110, ease: 'Quad.easeOut' });
    });
    this.on('pointerout', () => {
      this.bg.setFillStyle(options.fill ?? 0x1b1626, 0.92);
      scene.tweens.add({ targets: this, scale: 1, duration: 110, ease: 'Quad.easeOut' });
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      sfx.ui();
      scene.tweens.add({
        targets: this,
        scale: 0.97,
        duration: 70,
        yoyo: true,
        onComplete: () => onClick(),
      });
    });

    this.applyEnabledState();
    scene.add.existing(this);
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.applyEnabledState();
    return this;
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  /** Highlight state used by option pickers (difficulty, tabs, ...). */
  setSelected(selected: boolean): this {
    this.bg.setFillStyle(selected ? 0x3a2f1e : 0x1b1626, selected ? 1 : 0.92);
    this.bg.setStrokeStyle(2, selected ? this.accent : 0x4a4358, 1);
    this.label.setColor(selected ? '#f7e9c0' : '#b6adc8');
    return this;
  }

  private applyEnabledState(): void {
    this.setAlpha(this.enabled ? 1 : 0.42);
    this.bg.setStrokeStyle(2, this.enabled ? this.accent : 0x555066, 1);
    if (this.input) this.input.enabled = this.enabled;
  }
}
