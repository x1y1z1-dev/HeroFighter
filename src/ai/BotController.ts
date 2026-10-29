import Phaser from 'phaser';
import type { BotProfile } from '../config/game';
import type { PlatformDef } from '../data/stage';
import { createIntent, type Intent } from '../input/controller';
import type { Fighter } from '../objects/Fighter';

type Plan = 'idle' | 'approach' | 'retreat' | 'block' | 'jump' | 'chase-air' | 'punch' | 'kick';

// Real reach: bodyHalf(35) + attack range + defender bodyHalf(35).
// punch => 140 px, kick => 162 px. The bot aims slightly inside that.
const ATTACK_DISTANCE = { punch: 112, kick: 146 } as const;

/**
 * A readable, deliberately imperfect opponent.
 *
 * The bot re-plans every `thinkMs` (plus jitter) and commits to a short plan
 * instead of reacting every frame, which makes it feel human and keeps the
 * difficulty knobs meaningful.
 */
export class BotController {
  private readonly rng: Phaser.Math.RandomDataGenerator;
  private plan: Plan = 'idle';
  private planTimer = 0;
  private attackCooldown = 0;

  constructor(
    private readonly profile: BotProfile,
    seed?: string,
    private readonly platforms: readonly PlatformDef[] = [],
  ) {
    this.rng = new Phaser.Math.RandomDataGenerator(seed ? [seed] : undefined);
  }

  think(delta: number, self: Fighter, opponent: Fighter): Intent {
    const intent = createIntent();
    this.planTimer -= delta;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    if (self.state === 'ko' || self.state === 'hit') {
      this.plan = 'idle';
      this.planTimer = 0;
      return intent;
    }

    // Never interrupt our own attack; the state machine will release it.
    if (self.state === 'attack') return intent;

    const distance = Math.abs(opponent.x - self.x);
    const dy = opponent.y - self.y; // negative => the opponent is above us
    const toward: 'left' | 'right' = opponent.x > self.x ? 'right' : 'left';
    const away: 'left' | 'right' = toward === 'right' ? 'left' : 'right';

    // Opponent jumped onto a platform — go up after them instead of staring.
    if (dy < -70 && distance < 300 && this.plan !== 'chase-air' && this.plan !== 'block') {
      this.plan = 'chase-air';
      this.planTimer = 240 + this.rng.between(0, 160);
    }

    // Panic guard: react to a visible attack even mid-plan.
    if (
      opponent.state === 'attack' &&
      distance < 200 &&
      this.plan !== 'block' &&
      this.plan !== 'punch' &&
      this.plan !== 'kick' &&
      this.rng.frac() < this.profile.blockChance * 0.6
    ) {
      this.plan = 'block';
      this.planTimer = 260 + this.rng.between(0, 220);
    }

    if (this.planTimer <= 0) this.pickPlan(self, opponent, distance, dy);

    switch (this.plan) {
      case 'approach':
        if (distance > 96) intent[toward] = true;
        break;
      case 'retreat':
        intent[away] = true;
        break;
      case 'block':
        intent.block = true;
        break;
      case 'jump':
        intent.up = true;
        intent[toward] = true;
        this.plan = 'idle';
        this.planTimer = 180;
        break;
      case 'chase-air':
        if (distance > 36) intent[toward] = true;
        if (self.body.onFloor()) intent.up = true;
        break;
      case 'punch':
        if (distance > ATTACK_DISTANCE.punch) {
          intent[toward] = true;
        } else if (this.attackCooldown <= 0) {
          intent.punch = true;
          this.attackCooldown = 300 + this.rng.between(0, 200);
          this.plan = 'idle';
          this.planTimer = 160;
        }
        break;
      case 'kick':
        if (distance > ATTACK_DISTANCE.kick) {
          intent[toward] = true;
        } else if (this.attackCooldown <= 0) {
          intent.kick = true;
          this.attackCooldown = 380 + this.rng.between(0, 240);
          this.plan = 'idle';
          this.planTimer = 200;
        }
        break;
      case 'idle':
      default:
        break;
    }

    return intent;
  }

  private pickPlan(self: Fighter, opponent: Fighter, distance: number, dy: number): void {
    const p = this.profile;
    this.planTimer = p.thinkMs + this.rng.between(0, 120);

    if (this.rng.frac() < p.mistakeChance) {
      this.plan = this.rng.frac() < 0.5 ? 'idle' : 'retreat';
      return;
    }

    // Opponent is above (on a platform): climb after them.
    if (dy < -70 && distance < 320) {
      this.plan = 'chase-air';
      return;
    }

    // Punish a whiffed attack.
    if (opponent.state === 'attack' && distance < 180) {
      this.plan = distance < ATTACK_DISTANCE.punch ? 'punch' : 'kick';
      return;
    }

    // Don't grind against a blocking opponent.
    if (opponent.state === 'block' && distance < 150) {
      this.plan = this.rng.frac() < 0.5 ? 'retreat' : 'idle';
      return;
    }

    // Cornered: hop onto a platform when one is reachable, otherwise push out.
    if (self.x < 120 || self.x > 1160) {
      if (this.platformAbove(self) && this.rng.frac() < 0.55) {
        this.plan = 'jump';
        return;
      }
      this.plan = 'approach';
      return;
    }

    const roll = this.rng.frac();

    if (distance > 260) {
      if (roll < 0.12 && this.platformAbove(self)) {
        this.plan = 'jump';
        return;
      }
      this.plan = roll < 0.88 ? 'approach' : 'jump';
      return;
    }
    if (distance > ATTACK_DISTANCE.kick) {
      this.plan = roll < 0.62 ? 'approach' : roll < 0.82 ? 'kick' : 'retreat';
      return;
    }
    if (distance > ATTACK_DISTANCE.punch) {
      this.plan = roll < p.aggression ? 'kick' : roll < p.aggression + p.retreatChance ? 'retreat' : 'approach';
      return;
    }

    if (roll < p.aggression) {
      this.plan = this.rng.frac() < 0.62 ? 'punch' : 'kick';
    } else if (roll < p.aggression + p.retreatChance) {
      this.plan = 'retreat';
    } else if (roll < p.aggression + p.retreatChance + p.jumpChance) {
      this.plan = 'jump';
    } else {
      this.plan = this.rng.frac() < 0.5 ? 'block' : 'idle';
    }
  }

  /** Nearest platform the bot could jump onto from where it stands. */
  private platformAbove(self: Fighter): PlatformDef | null {
    for (const platform of this.platforms) {
      const rise = self.y - platform.y;
      if (rise < 60 || rise > 260) continue;
      const withinX = self.x > platform.x - 60 && self.x < platform.x + platform.width + 60;
      if (withinX) return platform;
    }
    return null;
  }
}
