import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { RULES } from '../config/game';
import { animKey } from '../data/animations';
import { resolveAttack, type AttackDef, type AttackKind } from '../data/attacks';
import type { CharacterDef } from '../data/characters';
import type { Intent } from '../input/controller';

export type { AttackDef, AttackKind } from '../data/attacks';

export type FighterState = 'idle' | 'walk' | 'jump' | 'block' | 'attack' | 'hit' | 'ko';

const BODY_WIDTH = 70;
const BODY_HEIGHT = 150;
/** Feet sit at 60/64 of the frame height. */
const ORIGIN_Y = 60 / 64;

export type HitResult = 'blocked' | 'hit';

export class Fighter extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly def: CharacterDef;
  health: number;
  override state: FighterState = 'idle';
  facing: 1 | -1 = 1;
  /** Set by the scene once an attack has connected, so it cannot multi-hit. */
  hitLanded = false;

  private stateTimer = 0;
  private attackDef: AttackDef | null = null;
  private attackElapsed = 0;
  private prevPunch = false;
  private prevKick = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: CharacterDef, facing: 1 | -1) {
    super(scene, x, y, def.id);
    this.def = def;
    this.health = RULES.maxHealth;

    this.setOrigin(0.5, ORIGIN_Y);
    this.setFacing(facing);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(BODY_WIDTH, BODY_HEIGHT);
    this.body.setOffset((192 - BODY_WIDTH) / 2, 180 - BODY_HEIGHT);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(700, 1800);
    // Drag lets knockback and attack lunges decay naturally instead of sliding forever.
    this.body.setDragX(900);

    this.play(animKey(def.id, 'idle'));
  }

  /* ------------------------------------------------------------------ */
  /* Queries                                                             */
  /* ------------------------------------------------------------------ */

  get currentAttack(): AttackDef | null {
    return this.state === 'attack' ? this.attackDef : null;
  }

  get isBlocking(): boolean {
    return this.state === 'block';
  }

  get isDown(): boolean {
    return this.state === 'ko';
  }

  /** Active hitbox in world space, or null when the attack is not live. */
  getAttackBox(): Phaser.Geom.Rectangle | null {
    const attack = this.currentAttack;
    if (!attack) return null;
    if (this.attackElapsed < attack.startup) return null;
    if (this.attackElapsed > attack.startup + attack.active) return null;

    const front = this.x + this.facing * (BODY_WIDTH / 2);
    const x = this.facing === 1 ? front : front - attack.range;
    return new Phaser.Geom.Rectangle(x, this.y + attack.offsetY, attack.range, attack.height);
  }

  getHurtBox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  setFacing(facing: 1 | -1): void {
    this.facing = facing;
    this.setFlipX(facing === -1);
  }

  respawn(x: number, y: number, facing: 1 | -1): void {
    this.setPosition(x, y);
    this.setFacing(facing);
    this.health = RULES.maxHealth;
    this.state = 'idle';
    this.stateTimer = 0;
    this.attackDef = null;
    this.attackElapsed = 0;
    this.hitLanded = false;
    this.prevPunch = false;
    this.prevKick = false;
    this.body.setVelocity(0, 0);
    this.clearTint();
    this.play(animKey(this.def.id, 'idle'), true);
  }

  /* ------------------------------------------------------------------ */
  /* Per-frame update                                                    */
  /* ------------------------------------------------------------------ */

  override update(delta: number, intent: Intent, opponentX: number): void {
    const punchEdge = intent.punch && !this.prevPunch;
    const kickEdge = intent.kick && !this.prevKick;
    this.prevPunch = intent.punch;
    this.prevKick = intent.kick;

    if (this.state === 'ko') {
      this.body.setVelocityX(0);
      return;
    }

    this.stateTimer = Math.max(0, this.stateTimer - delta);

    if (this.state === 'hit') {
      if (this.stateTimer <= 0 && this.body.onFloor()) this.enterState('idle');
      return;
    }

    if (this.state === 'attack') {
      this.attackElapsed += delta;
      const attack = this.attackDef;
      if (attack && this.attackElapsed >= attack.startup + attack.active + attack.recovery) {
        this.attackDef = null;
        this.enterState('idle');
      }
      return;
    }

    if (Math.abs(opponentX - this.x) > 6) {
      this.setFacing(opponentX > this.x ? 1 : -1);
    }

    if (punchEdge) {
      this.startAttack('punch');
      return;
    }
    if (kickEdge) {
      this.startAttack('kick');
      return;
    }

    const grounded = this.body.onFloor();

    if (grounded && intent.block) {
      this.body.setVelocityX(0);
      this.enterState('block');
      return;
    }

    if (grounded && intent.up) {
      this.body.setVelocityY(this.def.jump);
      this.enterState('jump');
      sfx.jump();
    }

    const dir = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
    if (dir !== 0) {
      const control = grounded ? 1 : 0.75;
      this.body.setVelocityX(dir * this.def.speed * control);
      if (grounded) this.enterState('walk');
    } else {
      this.body.setVelocityX(0);
      if (grounded) this.enterState('idle');
    }

    if (!this.body.onFloor()) {
      if (this.state !== 'jump') this.enterState('jump');
      this.setFrame(this.body.velocity.y < 0 ? 10 : 11);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Combat                                                              */
  /* ------------------------------------------------------------------ */

  startAttack(kind: AttackKind): void {
    const attack = resolveAttack(this.def, kind);
    this.state = 'attack';
    this.attackDef = attack;
    this.attackElapsed = 0;
    this.hitLanded = false;
    this.body.setVelocityX(attack.lunge > 0 ? this.facing * attack.lunge : 0);
    this.play(animKey(this.def.id, kind), true);
    sfx.swing(kind);
  }

  /**
   * Applies an incoming hit. `damage` is already scaled by both fighters'
   * power/defense values.
   */
  receiveHit(damage: number, attack: AttackDef, attackerFacing: 1 | -1): HitResult {
    const guarded = this.state === 'block' && this.facing === -attackerFacing;
    const pushDir = -attackerFacing;

    if (guarded) {
      this.health = Math.max(0, this.health - damage * 0.15);
      this.body.setVelocityX(pushDir * attack.knockback * 0.3);
      this.stateTimer = Math.max(this.stateTimer, 120);
      this.flashTint(0x9fc8ff);
      sfx.block();
      if (this.health <= 0) this.knockOut();
      return 'blocked';
    }

    this.health = Math.max(0, this.health - damage);
    this.attackDef = null;
    this.attackElapsed = 0;
    this.hitLanded = false;
    this.state = 'hit';
    this.stateTimer = attack.hitstun;
    this.body.setVelocityX(pushDir * attack.knockback);
    if (this.body.onFloor()) this.body.setVelocityY(-attack.knockback * 0.35);
    this.play(animKey(this.def.id, 'hit'), true);
    this.flashTint(0xff8a8a);
    sfx.impact(damage / 7);

    if (this.health <= 0) this.knockOut();
    return 'hit';
  }

  knockOut(): void {
    this.state = 'ko';
    this.stateTimer = 0;
    this.attackDef = null;
    this.body.setVelocityX(0);
    if (this.body.onFloor()) this.body.setVelocityY(-280);
    this.play(animKey(this.def.id, 'ko'), true);
    this.flashTint(0xff5555);
    sfx.ko();
  }

  private enterState(next: FighterState): void {
    if (this.state === next) return;
    this.state = next;

    if (next === 'jump') {
      this.anims.stop();
      this.setFrame(10);
      return;
    }
    // Attacks set their own animation in startAttack().
    if (next === 'attack') return;
    this.play(animKey(this.def.id, next), true);
  }

  private flashTint(color: number): void {
    this.setTintFill(color);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint();
    });
  }
}
