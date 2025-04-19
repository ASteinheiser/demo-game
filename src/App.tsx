import { useEffect, useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
import { MainMenu } from './game/scenes/MainMenu';
import { EventBus } from './game/EventBus';
// import { Button } from './components/ui/button';

function App() {
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  useEffect(() => {
    EventBus.on('menu-open__game-start', () => {
      const scene = phaserRef?.current?.scene as MainMenu;
      scene?.changeScene();
    });

    return () => {
      EventBus.off('menu-open__game-start');
    };
  }, []);

  const onCurrentSceneChange = (scene: Phaser.Scene) => {
    console.log(scene);
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <PhaserGame ref={phaserRef} currentActiveScene={onCurrentSceneChange} />
    </div>
  );
}

export default App;
