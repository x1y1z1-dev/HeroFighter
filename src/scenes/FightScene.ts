import Phaser from 'phaser';
import { BotController } from '../ai/BotController';
import { sfx } from '../audio/Sfx';
import { BOT_PROFILES, GAME_HEIGHT, GAME_WIDTH, RULES } from '../config/game';
import { getCharacter } from '../data/characters';
import type { AttackDef } from '../data/attacks';
import { DOJO } from '../data/stage';
import { createIntent, HumanController, P1_KEYS, P2_KEYS, type Intent } from '../input/controller';
import { Fighter } from '../objects/Fighter';
import { Hud } from '../ui/Hud';
import { UiButton } from '../ui/UiButton';
import { isMatchSetup, type MatchSetup } from '../types';

type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd' | 'paused';

interface PendingHit {
  attacker: Fighter;
  defender: Fighter;
  attack: AttackDef;
  damage: number;
  overlap: Phaser.Geom.Rectangle;
}

export class FightScene extends Phaser.Scene {
  private setup: MatchSetup = { mode: 'bot', p1: 'kai', p2: 'rin', difficulty: 'normal' };

  private p1!: Fighter;
  private p2!: Fighter;
  private hud!: Hud;

  private human1!: HumanController;
  private human2: HumanController | null = null;
  private bot1: BotController | null = null;
  private bot: BotController | null = null;

  private phase: Phase = 'intro';
  private resumePhase: Phase = 'intro';
  private phaseTimer = 0;
  private round = 1;
  private wins1 = 0;
  private wins2 = 0;
  private timeLeft: number = RULES.roundTimeMs;

  private overlay: Phaser.GameObjects.Container | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  /** Remaining freeze time after a hit connects (hit-stop). */
  private hitStopMs = 0;

  constructor() {
    super('Fight');
  }

  init(data: unknown): void {
    if (isMatchSetup(data)) this.setup = data;
    this.round = 1;
    this.wins1 = 0;
    this.wins2 = 0;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.timeLeft = RULES.roundTimeMs;
    this.overlay = null;
    this.human2 = null;
    this.bot1 = null;
    this.bot = null;
    this.hitStopMs = 0;
  }

  create(): void {
    this.add.image(0, 0, DOJO.textureKey).setOrigin(0).setDepth(0);

    const floor = this.add.rectangle(GAME_WIDTH / 2, DOJO.groundY + 60, GAME_WIDTH, 120, 0x000000, 0);
    this.physics.add.existing(floor, true);

    const platforms = DOJO.platforms.map((platform) => {
      const rect = this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        0x000000,
        0,
      );
      this.physics.add.existing(rect, true);
      return rect;
    });

    const def1 = getCharacter(this.setup.p1);
    const def2 = getCharacter(this.setup.p2);

    this.p1 = new Fighter(this, DOJO.spawn.p1, DOJO.groundY, def1, 1).setDepth(10);
    this.p2 = new Fighter(this, DOJO.spawn.p2, DOJO.groundY, def2, -1).setDepth(10);

    this.physics.add.collider(this.p1, floor);
    this.physics.add.collider(this.p2, floor);
    for (const platform of platforms) {
      this.physics.add.collider(this.p1, platform);
      this.physics.add.collider(this.p2, platform);
    }
    this.physics.add.collider(this.p1, this.p2);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.human1 = new HumanController(this, P1_KEYS);
    if (this.setup.mode === 'pvp') {
      this.human2 = new HumanController(this, P2_KEYS);
    } else {
      const profile = BOT_PROFILES[this.setup.difficulty];
      this.bot = new BotController(profile, `${this.setup.p2}-${Date.now()}`, DOJO.platforms);
      if (this.setup.mode === 'bvb') {
        this.bot1 = new BotController(profile, `${this.setup.p1}-${Date.now()}-a`, DOJO.platforms);
      }
    }

    this.hud = new Hud(this, def1, def2);
    this.hud.setHealth(this.p1.health, this.p2.health);
    this.hud.setTimer(this.timeLeft);
    this.hud.setWins(0, 0);
    this.hud.setHint(
      this.setup.mode === 'pvp'
        ? 'P1: A/D · W · S блок · G удар · H нога     P2: ←/→ · ↑ · ↓ · 5 · 6     ESC — пауза · M — звук'
        : this.setup.mode === 'bvb'
          ? 'Бот проти бота — режим спостереження. ESC — пауза · M — звук'
          : 'A/D рух · W стрибок · S блок · G удар · H нога · ESC пауза · M звук',
    );

    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;

    this.startRound();
  }

  override update(_time: number, delta: number): void {
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.togglePause();

    if (this.phase === 'paused' || this.phase === 'matchEnd') {
      this.hud.update(delta);
      return;
    }

    // Hit-stop: freeze the fighters for a few frames so impacts read clearly.
    if (this.hitStopMs > 0) {
      this.hitStopMs -= delta;
      if (this.hitStopMs <= 0) {
        this.hitStopMs = 0;
        this.physics.world.isPaused = false;
      }
      this.hud.update(delta);
      return;
    }

    const fighting = this.phase === 'fight';
    const intent1: Intent = fighting
      ? this.bot1
        ? this.bot1.think(delta, this.p1, this.p2)
        : this.human1.poll()
      : createIntent();
    let intent2: Intent = createIntent();
    if (fighting) {
      if (this.human2) intent2 = this.human2.poll();
      else if (this.bot) intent2 = this.bot.think(delta, this.p2, this.p1);
    }

    this.p1.update(delta, intent1, this.p2.x);
    this.p2.update(delta, intent2, this.p1.x);

    if (fighting) {
      this.resolveHits();
      this.timeLeft = Math.max(0, this.timeLeft - delta);
      if (this.timeLeft <= 0) this.endRoundByTime();
    }

    this.hud.setHealth(this.p1.health, this.p2.health);
    this.hud.setTimer(this.timeLeft);
    this.hud.update(delta);

    this.tickPhase(delta);
  }

  /* ------------------------------------------------------------------ */
  /* Round flow                                                          */
  /* ------------------------------------------------------------------ */

  private startRound(): void {
    this.phase = 'intro';
    this.phaseTimer = RULES.introMs;
    this.timeLeft = RULES.roundTimeMs;

    this.p1.respawn(DOJO.spawn.p1, DOJO.groundY, 1);
    this.p2.respawn(DOJO.spawn.p2, DOJO.groundY, -1);

    this.hud.setHealth(this.p1.health, this.p2.health);
    this.hud.setTimer(this.timeLeft);
    this.hud.setWins(this.wins1, this.wins2);
    this.hud.announce(`РАУНД ${this.round}`, '#f3d36a');
    sfx.bell();

    this.closeOverlay();
    this.physics.resume();
  }

  private tickPhase(delta: number): void {
    if (this.phase === 'intro') {
      this.phaseTimer -= delta;
      if (this.phaseTimer <= 0) {
        this.phase = 'fight';
        this.hud.announce('БІЙ!', '#ff9f6b');
        sfx.bell();
      }
      return;
    }

    if (this.phase === 'roundEnd') {
      this.phaseTimer -= delta;
      if (this.phaseTimer <= 0) this.afterRound();
    }
  }

  private endRound(winner: 1 | 2 | null, label: string): void {
    if (this.phase !== 'fight') return;

    this.phase = 'roundEnd';
    this.phaseTimer = RULES.roundEndMs;

    if (winner === 1) this.wins1 += 1;
    if (winner === 2) this.wins2 += 1;

    this.hud.setWins(this.wins1, this.wins2);
    this.hud.setHealth(this.p1.health, this.p2.health);
    this.hud.announce(label, winner === null ? '#c8c0d8' : '#ff6b6b');

    this.p1.body.setVelocityX(0);
    this.p2.body.setVelocityX(0);
  }

  private endRoundByTime(): void {
    if (this.p1.health === this.p2.health) {
      this.endRound(null, 'ЧАС · НІЧИЯ');
      return;
    }
    this.endRound(this.p1.health > this.p2.health ? 1 : 2, 'ЧАС');
  }

  private afterRound(): void {
    const matchOver =
      this.wins1 >= RULES.roundsToWin || this.wins2 >= RULES.roundsToWin || this.round >= RULES.maxRounds;

    if (matchOver) {
      this.showMatchEnd();
      return;
    }

    this.round += 1;
    this.startRound();
  }

  private showMatchEnd(): void {
    this.phase = 'matchEnd';
    this.physics.pause();

    const winner = this.wins1 > this.wins2 ? 1 : this.wins2 > this.wins1 ? 2 : 0;
    const title =
      winner === 0 ? 'НІЧИЯ' : `${winner === 1 ? this.p1.def.name : this.p2.def.name} ПЕРЕМАГАЄ`;
    const color = winner === 0 ? '#c8c0d8' : winner === 1 ? this.p1.def.accentCss : this.p2.def.accentCss;

    this.showOverlay(
      title,
      color,
      [
        { label: 'РЕВАНШ', onClick: () => this.scene.restart(this.setup) },
        { label: 'МЕНЮ', onClick: () => this.scene.start('Menu') },
      ],
      `Рахунок ${this.wins1} : ${this.wins2}`,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Combat resolution                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Resolves both fighters' active hitboxes in one pass. Both hits are collected
   * *before* any damage is applied, so attacks that connect on the same frame
   * trade evenly instead of always favouring player 1.
   */
  private resolveHits(): void {
    const hits: PendingHit[] = [];
    const first = this.collectHit(this.p1, this.p2);
    if (first) hits.push(first);
    const second = this.collectHit(this.p2, this.p1);
    if (second) hits.push(second);
    if (hits.length === 0) return;

    for (const hit of hits) hit.attacker.hitLanded = true;

    let blocked = false;
    for (const hit of hits) {
      const result = hit.defender.receiveHit(hit.damage, hit.attack, hit.attacker.facing);
      blocked = blocked || result === 'blocked';
      this.spawnImpact(hit.overlap.centerX, hit.overlap.centerY, result === 'blocked');
    }

    const singleBlock = blocked && hits.length === 1;
    this.cameras.main.shake(singleBlock ? 70 : 130, singleBlock ? 0.0025 : 0.006);
    this.hud.setHealth(this.p1.health, this.p2.health);

    const p1Down = this.p1.health <= 0;
    const p2Down = this.p2.health <= 0;
    const lethal = p1Down || p2Down;

    this.startHitStop(lethal ? 180 : singleBlock ? 45 : 80);

    if (p1Down && p2Down) {
      this.endRound(null, 'ПОДВІЙНЕ KO!');
    } else if (lethal) {
      this.endRound(p1Down ? 2 : 1, 'KO!');
    }
  }

  /** Snapshot of a hit that would land this frame (no side effects). */
  private collectHit(attacker: Fighter, defender: Fighter): PendingHit | null {
    if (attacker.hitLanded || attacker.isDown || defender.isDown) return null;

    const attackBox = attacker.getAttackBox();
    if (!attackBox) return null;

    const hurtBox = defender.getHurtBox();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(attackBox, hurtBox)) return null;

    const attack = attacker.currentAttack;
    if (!attack) return null;

    return {
      attacker,
      defender,
      attack,
      damage: (attack.damage * attacker.def.power) / defender.def.defense,
      overlap: Phaser.Geom.Intersects.GetRectangleIntersection(attackBox, hurtBox),
    };
  }

  private startHitStop(ms: number): void {
    this.hitStopMs = Math.max(this.hitStopMs, ms);
    this.physics.world.isPaused = true;
  }

  private spawnImpact(x: number, y: number, blocked: boolean): void {
    const color = blocked ? 0x9fc8ff : 0xffd166;
    const count = blocked ? 4 : 8;

    for (let i = 0; i < count; i += 1) {
      const shard = this.add
        .rectangle(x, y, Phaser.Math.Between(6, 13), Phaser.Math.Between(6, 13), color, 0.95)
        .setDepth(15);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(28, 78);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(180, 320),
        onComplete: () => shard.destroy(),
      });
    }

    const ring = this.add.circle(x, y, 16, color, 0.55).setDepth(15).setScale(0.35);
    this.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: 240,
      onComplete: () => ring.destroy(),
    });
  }

  /* ------------------------------------------------------------------ */
  /* Overlays                                                            */
  /* ------------------------------------------------------------------ */

  private togglePause(): void {
    if (this.phase === 'matchEnd') return;

    if (this.phase === 'paused') {
      this.closeOverlay();
      this.phase = this.resumePhase;
      this.physics.resume();
      return;
    }

    this.hitStopMs = 0;
    this.resumePhase = this.phase;
    this.phase = 'paused';
    this.physics.pause();

    this.showOverlay(
      'ПАУЗА',
      '#f7f0dc',
      [
        { label: 'ПРОДОВЖИТИ', onClick: () => this.togglePause() },
        { label: 'МЕНЮ', onClick: () => this.scene.start('Menu') },
      ],
      this.setup.mode === 'bot'
        ? `Бот: ${BOT_PROFILES[this.setup.difficulty].label}`
        : this.setup.mode === 'bvb'
          ? `Бот vs Бот · ${BOT_PROFILES[this.setup.difficulty].label}`
          : 'Локальний двобій',
    );
  }

  private showOverlay(
    title: string,
    color: string,
    buttons: ReadonlyArray<{ label: string; onClick: () => void }>,
    subtitle?: string,
  ): void {
    this.closeOverlay();

    const container = this.add.container(0, 0).setDepth(50);
    const shade = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x080610, 0.78)
      .setOrigin(0)
      .setInteractive();
    container.add(shade);

    const heading = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, title, {
        fontFamily: 'Verdana, "Segoe UI", sans-serif',
        fontSize: '64px',
        color,
        fontStyle: 'bold',
        stroke: '#120e18',
        strokeThickness: 10,
        align: 'center',
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5);
    container.add(heading);

    if (subtitle) {
      const sub = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 46, subtitle, {
          fontFamily: 'Verdana, "Segoe UI", sans-serif',
          fontSize: '20px',
          color: '#b9aecb',
        })
        .setOrigin(0.5);
      container.add(sub);
    }

    buttons.forEach((button, index) => {
      const uiButton = new UiButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 60 + index * 84,
        button.label,
        button.onClick,
        { width: 340, height: 64, fontSize: 24, accent: 0xf3d36a },
      );
      container.add(uiButton);
    });

    this.overlay = container;
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
  }
}
