import Phaser from 'phaser';
import { GAME_WIDTH, RULES } from '../config/game';
import type { CharacterDef } from '../data/characters';

const BAR_W = 470;
const BAR_H = 26;
const BAR_Y = 48;
const MARGIN = 46;

/**
 * In-fight HUD: health bars with chip damage, round pips, timer and the
 * centre announcement ("РАУНД 1", "БІЙ!", "KO!").
 */
export class Hud {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly announceText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  private readonly def1: CharacterDef;
  private readonly def2: CharacterDef;

  private health1: number = RULES.maxHealth;
  private health2: number = RULES.maxHealth;
  private chip1: number = RULES.maxHealth;
  private chip2: number = RULES.maxHealth;
  private wins1 = 0;
  private wins2 = 0;
  private timeMs: number = RULES.roundTimeMs;

  constructor(scene: Phaser.Scene, def1: CharacterDef, def2: CharacterDef) {
    this.def1 = def1;
    this.def2 = def2;

    this.gfx = scene.add.graphics().setDepth(20);

    scene.add
      .text(MARGIN, BAR_Y + BAR_H + 8, def1.name, {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '22px',
        color: def1.accentCss,
        fontStyle: 'bold',
      })
      .setDepth(21);

    scene.add
      .text(GAME_WIDTH - MARGIN, BAR_Y + BAR_H + 8, def2.name, {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '22px',
        color: def2.accentCss,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.timerText = scene.add
      .text(GAME_WIDTH / 2, BAR_Y + 4, '60', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '44px',
        color: '#f7f0dc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.announceText = scene.add
      .text(GAME_WIDTH / 2, 300, '', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '96px',
        color: '#f7f0dc',
        fontStyle: 'bold',
        stroke: '#120e18',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    this.hint = scene.add
      .text(GAME_WIDTH / 2, 690, '', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '15px',
        color: '#8d84a3',
      })
      .setOrigin(0.5)
      .setDepth(21);
  }

  setHint(text: string): void {
    this.hint.setText(text);
  }

  setHealth(h1: number, h2: number): void {
    this.health1 = Phaser.Math.Clamp(h1, 0, RULES.maxHealth);
    this.health2 = Phaser.Math.Clamp(h2, 0, RULES.maxHealth);
  }

  setTimer(ms: number): void {
    this.timeMs = Math.max(0, ms);
    this.timerText.setText(String(Math.ceil(this.timeMs / 1000)));
  }

  setWins(w1: number, w2: number): void {
    this.wins1 = w1;
    this.wins2 = w2;
  }

  announce(text: string, color = '#f7f0dc'): void {
    this.announceText.setText(text).setColor(color).setAlpha(1).setScale(0.72);
    this.announceText.scene.tweens.killTweensOf(this.announceText);
    this.announceText.scene.tweens.add({
      targets: this.announceText,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
    this.announceText.scene.tweens.add({
      targets: this.announceText,
      alpha: 0,
      delay: 780,
      duration: 260,
    });
  }

  clearAnnounce(): void {
    this.announceText.setAlpha(0);
  }

  update(delta: number): void {
    const ease = Math.min(1, delta / 180);
    this.chip1 += (this.health1 - this.chip1) * ease;
    this.chip2 += (this.health2 - this.chip2) * ease;

    this.gfx.clear();
    this.drawBar(MARGIN, false, this.health1, this.chip1, this.def1.accent);
    this.drawBar(GAME_WIDTH - MARGIN - BAR_W, true, this.health2, this.chip2, this.def2.accent);
    this.drawPips(MARGIN + BAR_W / 2, false, this.wins1);
    this.drawPips(GAME_WIDTH - MARGIN - BAR_W / 2, true, this.wins2);
  }

  private drawBar(x: number, mirror: boolean, health: number, chip: number, accent: number): void {
    this.gfx.fillStyle(0x0b0912, 0.82).fillRect(x - 5, BAR_Y - 5, BAR_W + 10, BAR_H + 10);
    this.gfx.lineStyle(2, 0x332a44, 1).strokeRect(x - 5, BAR_Y - 5, BAR_W + 10, BAR_H + 10);
    this.gfx.fillStyle(0x2a1a24, 1).fillRect(x, BAR_Y, BAR_W, BAR_H);

    const chipW = (chip / RULES.maxHealth) * BAR_W;
    const hpW = (health / RULES.maxHealth) * BAR_W;

    if (chipW > 0) {
      this.gfx.fillStyle(0xf3e3b0, 0.9).fillRect(mirror ? x + BAR_W - chipW : x, BAR_Y, chipW, BAR_H);
    }
    if (hpW > 0) {
      const hx = mirror ? x + BAR_W - hpW : x;
      this.gfx.fillStyle(accent, 1).fillRect(hx, BAR_Y, hpW, BAR_H);
      this.gfx.fillStyle(0xffffff, 0.22).fillRect(hx, BAR_Y, hpW, 7);
      this.gfx.fillStyle(0x000000, 0.18).fillRect(hx, BAR_Y + BAR_H - 5, hpW, 5);
    }
  }

  private drawPips(centerX: number, mirror: boolean, wins: number): void {
    const spacing = 26;
    for (let i = 0; i < RULES.roundsToWin; i++) {
      const x = centerX + (i - (RULES.roundsToWin - 1) / 2) * spacing * (mirror ? -1 : 1);
      const y = BAR_Y + BAR_H + 20;
      this.gfx.fillStyle(wins > i ? 0xf3d36a : 0x2c2438, 1);
      this.gfx.fillCircle(x, y, 7);
      this.gfx.lineStyle(2, 0x120e18, 1).strokeCircle(x, y, 7);
    }
  }
}
