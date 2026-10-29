import Phaser from 'phaser';
import { sfx } from './audio/Sfx';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS } from './config/game';
import { BootScene } from './scenes/BootScene';
import { ControlsScene } from './scenes/ControlsScene';
import { FightScene } from './scenes/FightScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0812',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravityY },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, SelectScene, ControlsScene, FightScene],
};

const game = new Phaser.Game(config);

// Exposed for debugging from the browser console (window.game.scene...).
declare global {
  interface Window {
    game: Phaser.Game;
  }
}
window.game = game;

// Browsers only allow audio after a user gesture.
window.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
window.addEventListener('keydown', (event) => {
  sfx.unlock();
  if (event.code === 'KeyM') sfx.toggleMute();
});

