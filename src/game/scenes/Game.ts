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
  playerEntities: Record<string, Phaser.Types.Physics.Arcade.SpriteWithDynamicBody> = {};
  currentPlayer: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  remoteRef: Phaser.GameObjects.Rectangle;

  cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  inputPayload = {
    left: false,
    right: false,
    up: false,
    down: false,
    attack: false,
  };
  elapsedTime = 0;
  fixedTimeStep = 1000 / 128;

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
      const entity = this.physics.add.sprite(player.x, player.y, 'player');
      this.anims.create({
        key: 'playerIdle',
        frames: this.anims.generateFrameNumbers('player', { frames: [0] }),
        frameRate: 100,
        repeat: 0,
      });
      this.anims.create({
        key: 'playerWalk',
        frames: this.anims.generateFrameNumbers('player', { frames: [2, 3, 4, 1] }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: 'playerPunch',
        frames: this.anims.generateFrameNumbers('player', { frames: [5, 6, 7, 8, 5] }),
        frameRate: 8,
        repeat: 0,
      });

      this.playerEntities[sessionId] = entity;

      // keep track of the current player
      if (sessionId === this.room.sessionId) {
        this.currentPlayer = entity;

        // tracks the player according to the server
        this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height);
        this.remoteRef.setStrokeStyle(1, 0xff0000);

        $(player).onChange(() => {
          this.remoteRef.x = player.x;
          this.remoteRef.y = player.y;
        });
      } else {
        // update the other players positions from the server
        $(player).onChange(() => {
          entity.setData('serverX', player.x);
          entity.setData('serverY', player.y);
          entity.setData('serverAttack', player.isAttacking);
          entity.setData('serverMovement', player.isMoving);
        });
      }
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

  update(_: number, delta: number): void {
    // skip if not yet connected
    if (!this.currentPlayer) return;

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick(this.fixedTimeStep);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fixedTick(_: number) {
    if (!this.room || !this.currentPlayer || !this.cursorKeys) return;

    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;
    this.inputPayload.attack = this.cursorKeys.space.isDown;
    this.room.send('playerInput', this.inputPayload);

    const velocity = 2;
    if (this.inputPayload.left) {
      this.currentPlayer.x -= velocity;
      this.currentPlayer.setFlipX(true);
    } else if (this.inputPayload.right) {
      this.currentPlayer.x += velocity;
      this.currentPlayer.setFlipX(false);
    }
    if (this.inputPayload.up) {
      this.currentPlayer.y -= velocity;
    } else if (this.inputPayload.down) {
      this.currentPlayer.y += velocity;
    }

    if (this.inputPayload.attack) {
      if (
        !this.currentPlayer.anims.isPlaying ||
        this.currentPlayer.anims.currentAnim?.key === 'playerWalk'
      ) {
        this.currentPlayer.play('playerPunch');
      }
    } else if (
      this.inputPayload.left ||
      this.inputPayload.right ||
      this.inputPayload.up ||
      this.inputPayload.down
    ) {
      if (!this.currentPlayer.anims.isPlaying) {
        this.currentPlayer.play('playerWalk');
      }
    } else if (
      this.currentPlayer.anims.currentAnim?.key !== 'playerPunch' ||
      !this.currentPlayer.anims.isPlaying
    ) {
      this.currentPlayer.play('playerIdle');
    }

    for (const sessionId in this.playerEntities) {
      // skip the current player
      if (sessionId === this.room.sessionId) continue;
      // interpolate all other player entities
      const entity = this.playerEntities[sessionId];
      const { serverX, serverY, serverAttack, serverMovement } = entity.data.values;

      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.2);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.2);
      entity.setFlipX(!(entity.x < serverX));

      if (serverAttack) {
        if (!entity.anims.isPlaying || entity.anims.currentAnim?.key === 'playerWalk') {
          entity.play('playerPunch');
        }
      } else if (serverMovement) {
        if (!entity.anims.isPlaying) {
          entity.play('playerWalk');
        }
      } else if (entity.anims.currentAnim?.key !== 'playerPunch' || !entity.anims.isPlaying) {
        entity.play('playerIdle');
      }
    }
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
