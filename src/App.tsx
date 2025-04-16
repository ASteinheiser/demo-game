import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
import { MainMenu } from './game/scenes/MainMenu';
import { Button } from './components/ui/button';

function App() {
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  const onCurrentSceneChange = (scene: Phaser.Scene) => {
    console.log(scene);
  };

  const changeScene = () => {
    if (phaserRef.current) {
      const scene = phaserRef.current.scene as MainMenu;
      scene?.changeScene();
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <PhaserGame ref={phaserRef} currentActiveScene={onCurrentSceneChange} />

      <div>
        <Button onClick={changeScene}>Change Scene</Button>
      </div>
    </div>
  );
}

export default App;
