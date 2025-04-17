import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Client } from 'colyseus.js';

const GAME_SERVER_URL = 'ws://localhost:2567';

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  gameText: Phaser.GameObjects.Text;
  client: Client;
  room: any;
  playerEntities: Record<string, Phaser.GameObjects.Image>;

  cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  inputPayload = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  constructor() {
    super('Game');

    if (!this.client) {
      this.client = new Client(GAME_SERVER_URL);
    }
  }

  preload() {
    this.cursorKeys = this.input.keyboard?.createCursorKeys();
  }

  async create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x00ff00);

    this.background = this.add.image(512, 384, 'background');
    this.background.setAlpha(0.5);

    try {
      if (!this.room) {
        this.room = await this.client.joinOrCreate('my_room', {});
      }
      console.log('joined successfully', this.room);
    } catch (e) {
      console.error('join error', e);
    }

    console.log({ room: this.room });

    EventBus.emit('current-scene-ready', this);
  }

  update(time: number, delta: number): void {
    // skip loop if not connected with room yet
    if (!this.room || !this.cursorKeys) return;

    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;
    this.room.send('movement', this.inputPayload);
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
