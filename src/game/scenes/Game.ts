import { Scene } from 'phaser';
import { Client, Room, getStateCallbacks } from 'colyseus.js';
import { EventBus } from '../EventBus';
import { Player } from '../objects/Player';

const GAME_SERVER_URL = 'ws://localhost:2567';

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  gameText: Phaser.GameObjects.Text;
  client: Client;
  room?: Room;
  playerEntities: Record<string, Player> = {};
  currentPlayer?: Player;
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

      const nameText = this.add
        .text(player.x, player.y, player.username, {
          fontSize: 12,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 2.5);

      const newPlayer = new Player(entity, nameText);

      this.playerEntities[sessionId] = newPlayer;

      // keep track of the current player
      if (sessionId === this.room?.sessionId) {
        this.currentPlayer = newPlayer;

        // #START FOR DEBUGGING PURPOSES
        // tracks the player according to the server
        this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height);
        this.remoteRef.setStrokeStyle(1, 0xff0000);

        $(player).onChange(() => {
          if (this.remoteRef) {
            this.remoteRef.x = player.x;
            this.remoteRef.y = player.y;
          }
        });
        // #END FOR DEBUGGING PURPOSES
      } else {
        // update the other players positions from the server
        $(player).onChange(() => {
          entity.setData('serverUsername', player.username);
          entity.setData('serverX', player.x);
          entity.setData('serverY', player.y);
          entity.setData('serverAttack', player.isAttacking);
        });
      }
    });

    $(this.room.state).players.onRemove((_, sessionId) => {
      const activePlayer = this.playerEntities[sessionId];
      if (activePlayer) {
        activePlayer.destroy();
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
    this.inputPayload.attack = this.cursorKeys.space.isDown;
    this.room.send('playerInput', this.inputPayload);

    if (this.inputPayload.attack) {
      this.currentPlayer.attack();
    }

    const velocity = 2;
    const { x, y } = this.currentPlayer.entity;
    const { left, right, up, down } = this.inputPayload;

    this.currentPlayer.move({
      x: left ? x - velocity : right ? x + velocity : x,
      y: up ? y - velocity : down ? y + velocity : y,
    });

    for (const sessionId in this.playerEntities) {
      // skip the current player
      if (sessionId === this.room.sessionId) continue;
      // interpolate all other player entities
      const serverPlayer = this.playerEntities[sessionId];
      const { serverX, serverY, serverAttack } = serverPlayer.entity.data.values;

      if (serverAttack) {
        serverPlayer.attack();
      } else {
        serverPlayer.stopAttack();
      }
      serverPlayer.move({
        x: Phaser.Math.Linear(serverPlayer.entity.x, serverX, 0.2),
        y: Phaser.Math.Linear(serverPlayer.entity.y, serverY, 0.2),
      });
    }
  }

  async changeScene() {
    const response = await fetch('http://localhost:2567/game-results');
    const data: Record<string, { username: string; attackCount: number }> = await response.json();
    const gameResults = Object.keys(data).map((sessionId) => ({
      username: data[sessionId].username,
      attackCount: data[sessionId].attackCount,
    }));

    this.currentPlayer?.destroy();
    this.remoteRef?.destroy();
    delete this.currentPlayer;
    delete this.remoteRef;

    if (this.room) {
      this.playerEntities[this.room.sessionId].destroy();
      delete this.playerEntities[this.room.sessionId];
      await this.room?.leave();
    }

    this.scene.start('GameOver', { gameResults });
  }
}
