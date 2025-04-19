import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Client, Room, getStateCallbacks } from 'colyseus.js';

const GAME_SERVER_URL = 'ws://localhost:2567';

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  gameText: Phaser.GameObjects.Text;
  client: Client;
  room?: Room;
  playerEntities: Record<
    string,
    { entity: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody; nameText: Phaser.GameObjects.Text }
  > = {};
  currentPlayer?: {
    entity: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    nameText: Phaser.GameObjects.Text;
  };
  remoteRef?: Phaser.GameObjects.Rectangle;

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
    // actual punch frame is 0.375s after start of animation
    this.anims.create({
      key: 'playerPunch',
      frames: this.anims.generateFrameNumbers('player', { frames: [5, 6, 7, 8, 5] }),
      frameRate: 8,
      repeat: 0,
    });
  }

  async create({ username }: { username: string }) {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x00ff00);

    this.background = this.add.image(512, 384, 'background');
    this.background.setAlpha(0.5);

    this.add
      .text(340, 10, 'Press Shift to leave the game')
      .setStyle({
        fontSize: 20,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setDepth(100);

    try {
      this.room = await this.client.joinOrCreate('my_room', { username });
    } catch (e) {
      console.error('join error', e);
    }
    if (!this.room) return;

    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player, sessionId) => {
      const entity = this.physics.add.sprite(player.x, player.y, 'player');

      const nameText = this.add.text(player.x, player.y, player.username, {
        fontSize: 12,
        stroke: '#000000',
        strokeThickness: 4,
      });
      nameText.setOrigin(0.5, 2.5);

      this.playerEntities[sessionId] = { entity, nameText };

      // keep track of the current player
      if (sessionId === this.room?.sessionId) {
        this.currentPlayer = { entity, nameText };
        // tracks the player according to the server
        this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height);
        this.remoteRef.setStrokeStyle(1, 0xff0000);

        $(player).onChange(() => {
          if (this.remoteRef) {
            this.remoteRef.x = player.x;
            this.remoteRef.y = player.y;
          }
        });
      } else {
        // update the other players positions from the server
        $(player).onChange(() => {
          entity.setData('serverX', player.x);
          entity.setData('serverY', player.y);
          entity.setData('serverAttack', player.isAttacking);
          entity.setData('serverMovement', player.isMoving);
          entity.setData('serverUsername', player.username);
        });
      }
    });

    $(this.room.state).players.onRemove((_, sessionId) => {
      const { entity, nameText } = this.playerEntities[sessionId];
      if (entity) {
        entity.destroy();
        nameText.destroy();
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

    // press shift to leave the game
    if (this.cursorKeys.shift.isDown) return this.changeScene();

    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;
    if (
      this.currentPlayer.entity.anims.isPlaying &&
      this.currentPlayer.entity.anims.currentAnim?.key === 'playerPunch'
    ) {
      this.inputPayload.attack = false;
    } else {
      this.inputPayload.attack = this.cursorKeys.space.isDown;
    }
    this.room.send('playerInput', this.inputPayload);

    const velocity = 2;
    if (this.inputPayload.left) {
      this.currentPlayer.entity.x -= velocity;
      this.currentPlayer.nameText.x -= velocity;
      this.currentPlayer.entity.setFlipX(true);
    } else if (this.inputPayload.right) {
      this.currentPlayer.entity.x += velocity;
      this.currentPlayer.nameText.x += velocity;
      this.currentPlayer.entity.setFlipX(false);
    }
    if (this.inputPayload.up) {
      this.currentPlayer.entity.y -= velocity;
      this.currentPlayer.nameText.y -= velocity;
    } else if (this.inputPayload.down) {
      this.currentPlayer.entity.y += velocity;
      this.currentPlayer.nameText.y += velocity;
    }

    if (this.inputPayload.attack) {
      if (
        !this.currentPlayer.entity.anims.isPlaying ||
        this.currentPlayer.entity.anims.currentAnim?.key === 'playerWalk'
      ) {
        this.currentPlayer.entity.play('playerPunch');
      }
    } else if (
      this.inputPayload.left ||
      this.inputPayload.right ||
      this.inputPayload.up ||
      this.inputPayload.down
    ) {
      if (!this.currentPlayer.entity.anims.isPlaying) {
        this.currentPlayer.entity.play('playerWalk');
      }
    } else if (
      this.currentPlayer.entity.anims.currentAnim?.key !== 'playerPunch' ||
      !this.currentPlayer.entity.anims.isPlaying
    ) {
      this.currentPlayer.entity.play('playerIdle');
    }

    for (const sessionId in this.playerEntities) {
      // skip the current player
      if (sessionId === this.room.sessionId) continue;
      // interpolate all other player entities
      const { entity, nameText } = this.playerEntities[sessionId];
      const { serverX, serverY, serverAttack, serverMovement } = entity.data.values;

      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.2);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.2);
      entity.setFlipX(!(entity.x < serverX));
      nameText.x = Phaser.Math.Linear(nameText.x, serverX, 0.2);
      nameText.y = Phaser.Math.Linear(nameText.y, serverY, 0.2);

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

  async changeScene() {
    this.currentPlayer?.entity.destroy();
    this.currentPlayer?.nameText.destroy();
    this.remoteRef?.destroy();
    delete this.currentPlayer;
    delete this.remoteRef;

    if (this.room) {
      delete this.playerEntities[this.room.sessionId];
      await this.room?.leave();
    }

    this.scene.start('GameOver');
  }
}
