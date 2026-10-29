/**
 * HeroFighter — procedural asset generator.
 *
 * Generates every bitmap the game needs, so the project has zero binary
 * dependencies and no third-party licence issues. Replace the output files
 * with real art later — the frame layout is documented in docs/SPRITES.md.
 *
 *   node tools/gen-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_SPRITES = resolve(ROOT, 'public/assets/sprites');
const OUT_STAGE = resolve(ROOT, 'public/assets/stage');

/* ------------------------------------------------------------------ */
/* PNG encoder (RGBA8, no dependencies)                                */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

class Bitmap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4); // transparent
  }

  blend(x, y, [r, g, b], alpha = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (alpha <= 0) return;
    const i = (y * this.width + x) * 4;
    const srcA = alpha;
    const dstA = this.data[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    this.data[i] = (r * srcA + this.data[i] * dstA * (1 - srcA)) / outA;
    this.data[i + 1] = (g * srcA + this.data[i + 1] * dstA * (1 - srcA)) / outA;
    this.data[i + 2] = (b * srcA + this.data[i + 2] * dstA * (1 - srcA)) / outA;
    this.data[i + 3] = outA * 255;
  }

  rect(x, y, w, h, color, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.blend(xx, yy, color, alpha);
    }
  }

  /** Soft vertical gradient, used for skies. */
  gradientV(y0, y1, top, bottom) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, Math.ceil(y1)); y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const color = [
        top[0] + (bottom[0] - top[0]) * t,
        top[1] + (bottom[1] - top[1]) * t,
        top[2] + (bottom[2] - top[2]) * t,
      ];
      this.rect(0, y, this.width, 1, color);
    }
  }

  disc(cx, cy, r, color, alpha = 1) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.blend(x, y, color, alpha);
      }
    }
  }

  /** Thick line = capsule, the workhorse for limbs. */
  capsule(x0, y0, x1, y1, thickness, color, alpha = 1) {
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    const r = thickness / 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, color, alpha);
    }
  }

  polygon(points, color, alpha = 1) {
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (a[1] === b[1]) continue;
        const yMin = Math.min(a[1], b[1]);
        const yMax = Math.max(a[1], b[1]);
        if (y < yMin || y > yMax) continue;
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + (b[0] - a[0]) * t);
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.blend(x, y, color, alpha);
      }
    }
  }

  blit(source, dx, dy) {
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const i = (y * source.width + x) * 4;
        const a = source.data[i + 3] / 255;
        if (a > 0) this.blend(dx + x, dy + y, [source.data[i], source.data[i + 1], source.data[i + 2]], a);
      }
    }
  }

  /** Nearest-neighbour upscale, keeps the pixel-art edges hard. */
  upscaled(factor) {
    const out = new Bitmap(this.width * factor, this.height * factor);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const si = (Math.floor(y / factor) * this.width + Math.floor(x / factor)) * 4;
        const di = (y * out.width + x) * 4;
        out.data[di] = this.data[si];
        out.data[di + 1] = this.data[si + 1];
        out.data[di + 2] = this.data[si + 2];
        out.data[di + 3] = this.data[si + 3];
      }
    }
    return out;
  }

  toPNG() {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 4 + 1)] = 0; // filter: none
      this.data.copy(raw, y * (this.width * 4 + 1) + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const shade = ([r, g, b], amount) => [
  Math.max(0, Math.min(255, r + amount)),
  Math.max(0, Math.min(255, g + amount)),
  Math.max(0, Math.min(255, b + amount)),
];

/* ------------------------------------------------------------------ */
/* Fighter sprite sheet                                                */
/* ------------------------------------------------------------------ */

export const FRAME = 192;
const RENDER = 64;
const UPSCALE = FRAME / RENDER;
const COLS = 8;
const ROWS = 3;

/** Frame indices — must stay in sync with src/data/animations.ts. */
export const FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  jump: [10, 11],
  punch: [12, 13, 14],
  kick: [15, 16, 17],
  hit: [18, 19],
  block: [20, 21],
  ko: [22],
};

const ROSTER = [
  {
    id: 'kai',
    skin: [226, 178, 140],
    gi: [58, 118, 214],
    trim: [244, 214, 96],
    hair: [38, 34, 46],
    belt: [24, 40, 84],
  },
  {
    id: 'rin',
    skin: [240, 202, 172],
    gi: [196, 58, 74],
    trim: [246, 236, 224],
    hair: [26, 22, 30],
    belt: [92, 20, 30],
  },
  {
    id: 'brutus',
    skin: [204, 150, 112],
    gi: [92, 122, 78],
    trim: [178, 146, 88],
    hair: [66, 44, 30],
    belt: [52, 40, 28],
  },
];

const OUTLINE = [18, 16, 24];

/**
 * Builds a pose in 64x64 space (feet ~y=60, facing right).
 * Every animation is a pure function of its frame index so regeneration is
 * deterministic.
 */
function poseFor(kind, frame, total) {
  const t = total <= 1 ? 0 : frame / (total - 1);
  const cycle = (frame / total) * Math.PI * 2;

  const pose = {
    bodyY: 0,
    lean: 0,
    headX: 32,
    headY: 14,
    shoulderF: [37, 26],
    shoulderB: [27, 26],
    handF: [40, 38],
    handB: [24, 38],
    hipF: [36, 43],
    hipB: [28, 43],
    footF: [36, 60],
    footB: [28, 60],
    fallen: false,
  };

  switch (kind) {
    case 'idle': {
      const bob = Math.sin(cycle) * 1.4;
      pose.bodyY = bob;
      pose.headY = 14 + bob;
      pose.handF = [41, 37 + bob * 1.6];
      pose.handB = [23, 37 + bob * 1.6];
      pose.footF = [36, 60];
      pose.footB = [27, 60];
      break;
    }
    case 'walk': {
      const swing = Math.sin(cycle);
      pose.bodyY = Math.abs(Math.cos(cycle)) * -1.6;
      pose.headY = 14 + pose.bodyY;
      pose.footF = [36 + swing * 9, 60 - Math.max(0, swing) * 5];
      pose.footB = [28 - swing * 9, 60 - Math.max(0, -swing) * 5];
      pose.handF = [40 - swing * 5, 37];
      pose.handB = [24 + swing * 5, 37];
      break;
    }
    case 'jump': {
      const rising = frame === 0;
      pose.bodyY = rising ? -2 : 1;
      pose.headY = 13;
      pose.footF = rising ? [39, 49] : [38, 58];
      pose.footB = rising ? [25, 51] : [26, 57];
      pose.handF = rising ? [42, 24] : [44, 30];
      pose.handB = rising ? [22, 24] : [20, 30];
      pose.lean = rising ? 2 : 0;
      break;
    }
    case 'punch': {
      // 0 wind-up, 1 strike (active), 2 recovery
      const reach = [0.45, 1, 0.6][frame] ?? 0.5;
      pose.lean = reach * 3;
      pose.bodyY = 0.5;
      pose.handF = [38 + 16 * reach, 31 + 2 * reach];
      pose.handB = [24 - 4 * reach, 36];
      pose.footF = [38, 60];
      pose.footB = [26, 60];
      pose.headY = 14;
      break;
    }
    case 'kick': {
      const reach = [0.5, 1, 0.55][frame] ?? 0.5;
      pose.lean = -reach * 4;
      pose.bodyY = -reach * 1.5;
      pose.footF = [36 + 17 * reach, 44 - 6 * reach];
      pose.footB = [27, 60];
      pose.handF = [38 - 2 * reach, 30];
      pose.handB = [22, 34];
      pose.headY = 13;
      break;
    }
    case 'hit': {
      pose.lean = -5;
      pose.bodyY = frame === 0 ? 1 : 2;
      pose.headX = 30;
      pose.headY = 16;
      pose.handF = [38, 26];
      pose.handB = [20, 28];
      pose.footF = [38, 60];
      pose.footB = [24, 60];
      break;
    }
    case 'block': {
      const bob = frame * 0.6;
      pose.bodyY = 1.5;
      pose.headY = 15;
      pose.handF = [38, 30 + bob];
      pose.handB = [36, 34 + bob];
      pose.lean = -2;
      pose.footF = [36, 60];
      pose.footB = [26, 60];
      break;
    }
    case 'ko': {
      pose.fallen = true;
      break;
    }
    default:
      break;
  }
  return pose;
}

function drawFighter(bitmap, ox, oy, pose, palette) {
  const P = (x, y) => [ox + x + pose.lean * ((60 - y) / 40), oy + y + pose.bodyY];
  const skin = palette.skin;
  const skinDark = shade(skin, -28);
  const gi = palette.gi;
  const giDark = shade(gi, -34);
  const trim = palette.trim;
  const hair = palette.hair;

  if (pose.fallen) {
    // Lying on the floor, head to the left, feet to the right.
    const [bx, by] = [ox + 8, oy + 54];
    bitmap.capsule(bx + 12, by, bx + 34, by - 1, 12, OUTLINE);
    bitmap.capsule(bx + 12, by, bx + 34, by - 1, 9, gi);
    bitmap.capsule(bx + 34, by - 1, bx + 44, by + 1, 9, OUTLINE);
    bitmap.capsule(bx + 34, by - 1, bx + 44, by + 1, 6, giDark);
    bitmap.capsule(bx + 10, by - 2, bx + 4, by - 6, 6, OUTLINE);
    bitmap.capsule(bx + 10, by - 2, bx + 4, by - 6, 4, skinDark);
    bitmap.disc(bx + 2, by - 8, 8, OUTLINE);
    bitmap.disc(bx + 2, by - 8, 6.5, skin);
    bitmap.disc(bx + 1, by - 11, 6.5, hair);
    return;
  }

  const neck = P(32, 23);
  const hip = P(32, 43);
  const hipF = P(...pose.hipF);
  const hipB = P(...pose.hipB);
  const footF = P(...pose.footF);
  const footB = P(...pose.footB);
  const shoulderF = P(...pose.shoulderF);
  const shoulderB = P(...pose.shoulderB);
  const handF = P(...pose.handF);
  const handB = P(...pose.handB);
  const kneeF = [(hipF[0] + footF[0]) / 2 + 2, (hipF[1] + footF[1]) / 2];
  const kneeB = [(hipB[0] + footB[0]) / 2 - 1, (hipB[1] + footB[1]) / 2];
  const elbowF = [(shoulderF[0] + handF[0]) / 2 + 1, (shoulderF[1] + handF[1]) / 2];
  const elbowB = [(shoulderB[0] + handB[0]) / 2 - 1, (shoulderB[1] + handB[1]) / 2];

  // --- back limbs -------------------------------------------------
  bitmap.capsule(hipB[0], hipB[1], kneeB[0], kneeB[1], 9, OUTLINE);
  bitmap.capsule(kneeB[0], kneeB[1], footB[0], footB[1], 9, OUTLINE);
  bitmap.capsule(hipB[0], hipB[1], kneeB[0], kneeB[1], 6, giDark);
  bitmap.capsule(kneeB[0], kneeB[1], footB[0], footB[1], 6, giDark);
  bitmap.disc(footB[0] + 1, footB[1] - 1, 4, OUTLINE);
  bitmap.disc(footB[0] + 1, footB[1] - 1, 3, shade(giDark, -18));

  bitmap.capsule(shoulderB[0], shoulderB[1], elbowB[0], elbowB[1], 8, OUTLINE);
  bitmap.capsule(elbowB[0], elbowB[1], handB[0], handB[1], 8, OUTLINE);
  bitmap.capsule(shoulderB[0], shoulderB[1], elbowB[0], elbowB[1], 5, giDark);
  bitmap.capsule(elbowB[0], elbowB[1], handB[0], handB[1], 5, giDark);
  bitmap.disc(handB[0], handB[1], 3.4, OUTLINE);
  bitmap.disc(handB[0], handB[1], 2.6, skinDark);

  // --- torso ------------------------------------------------------
  const torsoPts = [
    [neck[0] - 7, neck[1] - 1],
    [neck[0] + 7, neck[1] - 1],
    [hip[0] + 7, hip[1] + 2],
    [hip[0] - 7, hip[1] + 2],
  ];
  bitmap.polygon(
    torsoPts.map(([x, y]) => [x - 1.5, y - 1.5]),
    OUTLINE,
  );
  bitmap.polygon(torsoPts, gi);
  // sash / trim
  bitmap.rect(hip[0] - 7, hip[1] - 5, 14, 3, palette.belt);
  bitmap.polygon(
    [
      [neck[0] - 3, neck[1] + 1],
      [neck[0] + 4, neck[1] + 1],
      [hip[0] + 1, hip[1] - 4],
      [hip[0] - 4, hip[1] - 4],
    ],
    trim,
    0.9,
  );

  // --- front limbs ------------------------------------------------
  bitmap.capsule(hipF[0], hipF[1], kneeF[0], kneeF[1], 10, OUTLINE);
  bitmap.capsule(kneeF[0], kneeF[1], footF[0], footF[1], 10, OUTLINE);
  bitmap.capsule(hipF[0], hipF[1], kneeF[0], kneeF[1], 7, gi);
  bitmap.capsule(kneeF[0], kneeF[1], footF[0], footF[1], 7, gi);
  bitmap.disc(footF[0] + 2, footF[1] - 1, 4.2, OUTLINE);
  bitmap.disc(footF[0] + 2, footF[1] - 1, 3.2, shade(gi, -12));

  bitmap.capsule(shoulderF[0], shoulderF[1], elbowF[0], elbowF[1], 9, OUTLINE);
  bitmap.capsule(elbowF[0], elbowF[1], handF[0], handF[1], 9, OUTLINE);
  bitmap.capsule(shoulderF[0], shoulderF[1], elbowF[0], elbowF[1], 6, gi);
  bitmap.capsule(elbowF[0], elbowF[1], handF[0], handF[1], 6, skin);
  bitmap.disc(handF[0], handF[1], 3.8, OUTLINE);
  bitmap.disc(handF[0], handF[1], 3, skin);

  // --- head -------------------------------------------------------
  const head = P(pose.headX, pose.headY);
  bitmap.disc(head[0], head[1], 8.4, OUTLINE);
  bitmap.disc(head[0], head[1], 7.2, skin);
  // hair: cap + fringe + sideburns (leaves the face readable)
  bitmap.rect(head[0] - 6, head[1] - 8, 12, 4, hair);
  bitmap.rect(head[0] - 7, head[1] - 4.5, 14, 2, hair);
  bitmap.rect(head[0] - 7, head[1] - 4.5, 2, 5, hair);
  bitmap.rect(head[0] + 5, head[1] - 4.5, 2, 4, hair);
  bitmap.rect(head[0] - 5, head[1] - 8, 10, 1, shade(hair, 26));
  // eye + brow + mouth
  bitmap.rect(head[0] + 2, head[1] - 0.5, 3, 2, OUTLINE);
  bitmap.rect(head[0] + 2, head[1] - 2, 4, 1, hair);
  bitmap.rect(head[0] - 0.5, head[1] + 4, 3, 1, skinDark);
}

function buildSpriteSheet(palette) {
  const sheet = new Bitmap(FRAME * COLS, FRAME * ROWS);
  let index = 0;
  for (const [kind, frames] of Object.entries(FRAMES)) {
    for (let i = 0; i < frames.length; i++) {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const frame = new Bitmap(RENDER, RENDER);
      drawFighter(frame, 0, 0, poseFor(kind, i, frames.length), palette);
      sheet.blit(frame.upscaled(UPSCALE), col * FRAME, row * FRAME);
      index++;
    }
  }
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Stage background                                                    */
/* ------------------------------------------------------------------ */

export const STAGE = {
  width: 1280,
  height: 720,
  groundY: 600,
  platforms: [
    { x: 150, y: 452, width: 260, height: 22 },
    { x: 870, y: 452, width: 260, height: 22 },
    { x: 520, y: 352, width: 240, height: 22 },
  ],
};

function buildStage() {
  const bmp = new Bitmap(STAGE.width, STAGE.height);
  bmp.gradientV(0, 520, [24, 22, 52], [206, 108, 96]);
  // sun
  bmp.disc(1010, 300, 92, [252, 214, 140], 0.55);
  bmp.disc(1010, 300, 62, [255, 236, 186], 0.85);
  // far mountains
  bmp.polygon(
    [
      [-40, 520],
      [180, 300],
      [380, 520],
    ],
    [58, 44, 78],
  );
  bmp.polygon(
    [
      [240, 520],
      [520, 268],
      [800, 520],
    ],
    [46, 36, 66],
  );
  bmp.polygon(
    [
      [700, 520],
      [980, 322],
      [1320, 520],
    ],
    [58, 44, 78],
  );
  // haze
  bmp.rect(0, 470, STAGE.width, 60, [210, 130, 120], 0.18);
  // horizon fill (prevents a transparent band between sky and floor)
  bmp.rect(0, 512, STAGE.width, STAGE.groundY - 512, [44, 32, 44]);
  bmp.rect(0, 512, STAGE.width, 10, [86, 56, 62], 0.5);
  // temple silhouettes
  for (const [x, w, h] of [
    [80, 150, 150],
    [1050, 170, 175],
  ]) {
    bmp.rect(x, 520 - h, w, h, [34, 26, 44]);
    bmp.polygon(
      [
        [x - 22, 520 - h],
        [x + w / 2, 520 - h - 46],
        [x + w + 22, 520 - h],
      ],
      [26, 20, 36],
    );
  }
  // lanterns
  for (const [x, y] of [
    [330, 210],
    [960, 190],
  ]) {
    bmp.disc(x, y, 12, [250, 170, 96], 0.9);
    bmp.disc(x, y, 26, [250, 170, 96], 0.16);
    bmp.rect(x - 1, y - 90, 2, 78, [40, 30, 40], 0.6);
  }

  // ground slab
  bmp.rect(0, STAGE.groundY, STAGE.width, STAGE.height - STAGE.groundY, [46, 34, 42]);
  bmp.rect(0, STAGE.groundY, STAGE.width, 6, [214, 178, 118]);
  bmp.rect(0, STAGE.groundY + 6, STAGE.width, 4, [156, 120, 78]);
  for (let x = 0; x < STAGE.width; x += 64) {
    bmp.rect(x, STAGE.groundY + 10, 2, STAGE.height - STAGE.groundY - 10, [36, 26, 34], 0.7);
  }
  for (let y = STAGE.groundY + 26; y < STAGE.height; y += 26) {
    bmp.rect(0, y, STAGE.width, 2, [38, 28, 36], 0.5);
  }

  // floating platforms
  for (const p of STAGE.platforms) {
    bmp.rect(p.x - 3, p.y - 3, p.width + 6, p.height + 6, [22, 18, 26]);
    bmp.rect(p.x, p.y, p.width, p.height, [104, 78, 62]);
    bmp.rect(p.x, p.y, p.width, 5, [222, 188, 126]);
    for (let x = p.x + 18; x < p.x + p.width; x += 46) {
      bmp.rect(x, p.y + 6, 2, p.height - 6, [78, 56, 44]);
    }
    bmp.rect(p.x + 8, p.y + p.height + 3, p.width - 16, 6, [16, 12, 18], 0.35);
  }

  return bmp;
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

mkdirSync(OUT_SPRITES, { recursive: true });
mkdirSync(OUT_STAGE, { recursive: true });

for (const palette of ROSTER) {
  const file = resolve(OUT_SPRITES, `${palette.id}.png`);
  writeFileSync(file, buildSpriteSheet(palette).toPNG());
  console.log(`sprite sheet -> public/assets/sprites/${palette.id}.png`);
}

writeFileSync(resolve(OUT_STAGE, 'dojo.png'), buildStage().toPNG());
console.log('stage -> public/assets/stage/dojo.png');
