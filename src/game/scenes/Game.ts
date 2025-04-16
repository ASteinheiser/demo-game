import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Client } from 'colyseus.js';

const GAME_SERVER_URL = 'ws://localhost:2567';

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  gameText: Phaser.GameObjects.Text;
  client: Client;

  constructor() {
    super('Game');

    if (!this.client) {
      this.client = new Client(GAME_SERVER_URL);
    }
  }

  async create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x00ff00);

    this.background = this.add.image(512, 384, 'background');
    this.background.setAlpha(0.5);

    try {
      const room = await this.client.joinOrCreate('my_room', {
        /* options */
      });
      console.log('joined successfully', room);
    } catch (e) {
      console.error('join error', e);
    }

    EventBus.emit('current-scene-ready', this);
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
