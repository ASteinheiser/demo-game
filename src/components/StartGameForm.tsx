import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface StartGameFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (args: { username: string }) => void;
}

export const StartGameForm = ({ isOpen, onOpenChange, onSubmit }: StartGameFormProps) => {
  const [username, setUsername] = useState('');

  const handleSubmit = () => {
    const trimmedUsername = username.trim();
    if (trimmedUsername === '') return;

    onSubmit({ username: trimmedUsername });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a game</DialogTitle>
          <DialogDescription>Enter your username to join a game</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Username
            </Label>
            <Input
              id="name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            Join game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
