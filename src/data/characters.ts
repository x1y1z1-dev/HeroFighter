import type { CharacterAttacks } from './attacks';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  /** UI accent colour. */
  accent: number;
  accentCss: string;
  /** Horizontal run speed, px/s. */
  speed: number;
  /** Jump impulse (negative = up). */
  jump: number;
  /** Damage multiplier when attacking. */
  power: number;
  /** Damage taken multiplier (lower = tankier). */
  defense: number;
  bio: string;
  /** Short description of the character's attack style, shown on the select screen. */
  style: string;
  /** Per-character attack overrides. */
  attacks?: CharacterAttacks;
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'kai',
    name: 'KAI',
    title: 'Швидкий учень',
    accent: 0x3a76d6,
    accentCss: '#3a76d6',
    speed: 320,
    jump: -780,
    power: 1,
    defense: 1,
    bio: 'Збалансований боєць. Гарний вибір для першої гри.',
    style: 'Рівні удари без сюрпризів',
  },
  {
    id: 'rin',
    name: 'RIN',
    title: 'Тінь полумʼя',
    accent: 0xc43a4a,
    accentCss: '#c43a4a',
    speed: 350,
    jump: -820,
    power: 0.92,
    defense: 1.05,
    bio: 'Найшвидша, але тримає менше ударів. Тиск і мобільність.',
    style: 'Швидкі удари, ривок у стрибковому ударі',
    attacks: {
      punch: { damage: 5, startup: 50, recovery: 110, knockback: 120, hitstun: 190 },
      kick: {
        damage: 9,
        startup: 120,
        active: 100,
        recovery: 230,
        range: 100,
        knockback: 230,
        hitstun: 300,
        lunge: 240,
      },
    },
  },
  {
    id: 'brutus',
    name: 'BRUTUS',
    title: 'Камʼяна стіна',
    accent: 0x5c7a4e,
    accentCss: '#5c7a4e',
    speed: 250,
    jump: -730,
    power: 1.2,
    defense: 0.86,
    bio: 'Повільний, зате бʼє боляче і добре тримає удар.',
    style: 'Важкі повільні удари з сильним відкидом',
    attacks: {
      punch: { damage: 8, startup: 95, recovery: 190, knockback: 210, hitstun: 260 },
      kick: {
        damage: 14,
        startup: 190,
        active: 100,
        recovery: 300,
        range: 84,
        height: 52,
        knockback: 380,
        hitstun: 400,
      },
    },
  },
];

export const getCharacter = (id: string): CharacterDef => {
  const found = CHARACTERS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown character: ${id}`);
  return found;
};
