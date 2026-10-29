export type AttackKind = 'punch' | 'kick';

export interface AttackDef {
  kind: AttackKind;
  /** Human-readable name shown in the UI. */
  label: string;
  damage: number;
  /** ms before the hitbox turns on. */
  startup: number;
  /** ms the hitbox stays on. */
  active: number;
  /** ms of recovery after the hitbox turns off. */
  recovery: number;
  /** Reach in front of the body, px. */
  range: number;
  height: number;
  /** Hitbox centre Y, relative to the fighter's feet (negative = up). */
  offsetY: number;
  knockback: number;
  hitstun: number;
  /** Forward dash impulse at the start of the attack, px/s. */
  lunge: number;
}

export type AttackModifier = Partial<Omit<AttackDef, 'kind'>>;

/** Per-character tweaks applied on top of BASE_ATTACKS. */
export type CharacterAttacks = Partial<Record<AttackKind, AttackModifier>>;

export const BASE_ATTACKS: Record<AttackKind, AttackDef> = {
  punch: {
    kind: 'punch',
    label: 'Удар рукою',
    damage: 6,
    startup: 70,
    active: 70,
    recovery: 150,
    range: 70,
    height: 48,
    offsetY: -108,
    knockback: 150,
    hitstun: 220,
    lunge: 0,
  },
  kick: {
    kind: 'kick',
    label: 'Удар ногою',
    damage: 11,
    startup: 140,
    active: 90,
    recovery: 260,
    range: 92,
    height: 44,
    offsetY: -64,
    knockback: 280,
    hitstun: 340,
    lunge: 0,
  },
};

export const resolveAttack = (
  character: { attacks?: CharacterAttacks },
  kind: AttackKind,
): AttackDef => {
  const base = BASE_ATTACKS[kind];
  const override = character.attacks?.[kind];
  return override ? { ...base, ...override } : { ...base };
};
