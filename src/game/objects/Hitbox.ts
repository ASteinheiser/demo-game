// how long the hitbox should be visible
const HITBOX_LIFETIME = 2000;

const HITBOX_WIDTH = 6;
const HITBOX_HEIGHT = 8;

export class Hitbox {
  hitbox?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.hitbox = scene.add.rectangle(x, y, HITBOX_WIDTH, HITBOX_HEIGHT, 0x0000ff, 0.5);

    scene.time.delayedCall(HITBOX_LIFETIME, () => {
      this.destroy();
    });
  }

  destroy() {
    this.hitbox?.destroy();
  }
}
