import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, BOT_PROFILES, type Difficulty } from '../config/game';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { DOJO } from '../data/stage';
import type { GameMode, MatchSetup } from '../types';
import { UiButton } from '../ui/UiButton';

const CARD_W = 340;
const CARD_H = 104;
const LEFT_X = 240;
const RIGHT_X = GAME_WIDTH - 240;
const CARD_Y = [236, 356, 476];

interface CardRef {
  side: 'p1' | 'p2';
  id: string;
  bg: Phaser.GameObjects.Rectangle;
  def: CharacterDef;
}

export class SelectScene extends Phaser.Scene {
  private mode: GameMode = 'bot';
  private selected: { p1: string | null; p2: string | null } = { p1: 'kai', p2: 'rin' };
  private difficulty: Difficulty = 'normal';
  private cards: CardRef[] = [];
  private startButton!: UiButton;
  private difficultyButtons: { id: Difficulty; button: UiButton }[] = [];

  constructor() {
    super('Select');
  }

  init(data: unknown): void {
    const mode = (data as { mode?: GameMode } | undefined)?.mode;
    this.mode = mode === 'pvp' ? 'pvp' : mode === 'bvb' ? 'bvb' : 'bot';
    this.selected = { p1: 'kai', p2: 'rin' };
    this.difficulty = 'normal';
    this.cards = [];
    this.difficultyButtons = [];
  }

  create(): void {
    this.add.image(0, 0, DOJO.textureKey).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0812, 0.74).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 64, 'ОБЕРИ БІЙЦЯ', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '46px',
        color: '#f7f0dc',
        fontStyle: 'bold',
        stroke: '#1a1024',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(LEFT_X, 150, this.mode === 'bvb' ? 'БОТ 1' : 'ГРАВЕЦЬ 1', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '22px',
        color: this.mode === 'bvb' ? '#7ee0a6' : '#f3d36a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(RIGHT_X, 150, this.mode === 'pvp' ? 'ГРАВЕЦЬ 2' : this.mode === 'bvb' ? 'БОТ 2' : 'БОТ', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '22px',
        color: this.mode === 'pvp' ? '#7ea6e0' : this.mode === 'bvb' ? '#7ee0a6' : '#ff9f6b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 340, 'VS', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '72px',
        color: '#f7f0dc',
        fontStyle: 'bold',
        stroke: '#1a1024',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    CHARACTERS.forEach((def, index) => {
      this.createCard(LEFT_X, CARD_Y[index], 'p1', def);
      this.createCard(RIGHT_X, CARD_Y[index], 'p2', def);
    });

    if (this.mode !== 'pvp') {
      this.createDifficultyPicker();
    }

    new UiButton(this, 110, 60, '◀ НАЗАД', () => this.scene.start('Menu'), {
      width: 170,
      height: 46,
      fontSize: 18,
      accent: 0x7ea6e0,
    });

    this.startButton = new UiButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 50,
      'БІЙ ▶',
      () => this.startMatch(),
      { width: 320, height: 56, fontSize: 28, accent: 0xf3d36a },
    );

    this.input.keyboard?.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));

    this.refresh();
  }

  private createCard(x: number, y: number, side: 'p1' | 'p2', def: CharacterDef): void {
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x171222, 0.94).setStrokeStyle(3, 0x2e2740);
    const stripe = this.add.rectangle(-CARD_W / 2 + 6, 0, 8, CARD_H - 14, def.accent);
    const portrait = this.add.sprite(-CARD_W / 2 + 66, 4, def.id, 0).setScale(0.44);
    const name = this.add.text(-CARD_W / 2 + 116, -32, def.name, {
      fontFamily: 'Verdana, "Segoe UI", sans-serif',
      fontSize: '24px',
      color: '#f7f0dc',
      fontStyle: 'bold',
    });
    const title = this.add.text(-CARD_W / 2 + 116, 2, def.title, {
      fontFamily: 'Verdana, "Segoe UI", sans-serif',
      fontSize: '14px',
      color: '#b9aecb',
    });
    const stats = this.add.text(
      -CARD_W / 2 + 116,
      26,
      `ШВ ${def.speed}   СИЛА ${Math.round(def.power * 100)}   ЗАХ ${Math.round((2 - def.defense) * 100)}`,
      {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '12px',
        color: '#8d84a3',
      },
    );

    const card = this.add.container(x, y, [bg, stripe, portrait, name, title, stats]);
    card.setSize(CARD_W, CARD_H);
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    card.on('pointerover', () => {
      if (this.selected[side] !== def.id) bg.setFillStyle(0x241c34, 1);
    });
    card.on('pointerout', () => {
      if (this.selected[side] !== def.id) bg.setFillStyle(0x171222, 0.94);
    });
    card.on('pointerdown', () => {
      this.selected[side] = def.id;
      this.refresh();
    });

    this.cards.push({ side, id: def.id, bg, def });
  }

  private createDifficultyPicker(): void {
    this.add
      .text(GAME_WIDTH / 2, 552, this.mode === 'bvb' ? 'СКЛАДНІСТЬ ОБОХ БОТІВ' : 'СКЛАДНІСТЬ БОТА', {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '15px',
        color: '#8d84a3',
      })
      .setOrigin(0.5);

    (Object.keys(BOT_PROFILES) as Difficulty[]).forEach((id, index) => {
      const button = new UiButton(
        this,
        GAME_WIDTH / 2 + (index - 1) * 170,
        592,
        BOT_PROFILES[id].label,
        () => {
          this.difficulty = id;
          this.refresh();
        },
        { width: 156, height: 44, fontSize: 17, accent: 0xff9f6b },
      );
      this.difficultyButtons.push({ id, button });
    });
  }

  private refresh(): void {
    for (const card of this.cards) {
      const chosen = this.selected[card.side] === card.id;
      card.bg.setStrokeStyle(3, chosen ? card.def.accent : 0x2e2740, 1);
      card.bg.setFillStyle(chosen ? 0x2a2140 : 0x171222, 0.94);
    }

    for (const entry of this.difficultyButtons) {
      entry.button.setSelected(entry.id === this.difficulty);
    }

    const ready = this.selected.p1 !== null && this.selected.p2 !== null;
    this.startButton.setEnabled(ready);
  }

  private startMatch(): void {
    if (!this.selected.p1 || !this.selected.p2) return;
    const setup: MatchSetup = {
      mode: this.mode,
      p1: this.selected.p1,
      p2: this.selected.p2,
      difficulty: this.difficulty,
    };
    this.scene.start('Fight', setup);
  }
}
