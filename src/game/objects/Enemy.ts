export class Enemy {
  entity: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.entity = scene.physics.add.sprite(x, y, 'enemy');
  }

  destroy() {
    this.entity?.destroy();
  }
}
