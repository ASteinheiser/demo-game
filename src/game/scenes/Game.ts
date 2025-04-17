import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Client, Room, getStateCallbacks } from 'colyseus.js';

const GAME_SERVER_URL = 'ws://localhost:2567';

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  gameText: Phaser.GameObjects.Text;
  client: Client;
  room: Room;
  playerEntities: Record<string, Phaser.GameObjects.Image> = {};

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
    } catch (e) {
      console.error('join error', e);
    }

    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player, sessionId) => {
      const entity = this.physics.add.image(player.x, player.y, 'enemy');
      this.playerEntities[sessionId] = entity;

      $(player).onChange(() => {
        entity.setData('serverX', player.x);
        entity.setData('serverY', player.y);
      });
    });

    $(this.room.state).players.onRemove((_, sessionId) => {
      const entity = this.playerEntities[sessionId];
      if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
      }
    });

    EventBus.emit('current-scene-ready', this);
  }

  update(): void {
    // skip loop if not connected with room yet
    if (!this.room || !this.cursorKeys) return;

    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;
    this.room.send('movement', this.inputPayload);

    for (const sessionId in this.playerEntities) {
      // interpolate all player entities
      const entity = this.playerEntities[sessionId];
      const { serverX, serverY } = entity.data.values;

      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.2);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.2);
    }
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
