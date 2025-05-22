import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Label } from './label'; // For associating with Checkbox
import { useState } from 'react'; // For managing checkbox state

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onOpenChange: fn(), // Spy on openChange
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Story that is open by default for visual testing
const DialogWithCustomContentComponent = (args: Story['args']) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog {...args}>
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-[#e2e2e2]">Dialog Title</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            This is a description for the dialog. It can contain more detailed information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 flex items-center space-x-2">
          <Checkbox 
            id="dontShowAgainStory"
            checked={dontShowAgain} 
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            className="border-[#353535] data-[state=checked]:bg-[#C2F751] data-[state=checked]:text-black"
          />
          <Label 
            htmlFor="dontShowAgainStory" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#e2e2e2]"
          >
            Don't show me this again
          </Label>
        </div>
        
        <DialogFooter className="flex justify-end mt-4">
          <Button 
            onClick={fn()} // Mock action for story
            className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
          >
            Primary Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DefaultOpenWithCustomContent: Story = {
  args: {
    open: true,
  },
  render: DialogWithCustomContentComponent,
};

// Story that uses a trigger
const DialogWithTriggerComponent = (args: Story['args']) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  // For triggered dialog, manage open state locally if not passed in args
  // However, Storybook's default behavior with onOpenChange arg might handle it

  return (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-[#e2e2e2] border-[#353535] hover:bg-[#353535]">Show Dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-[#e2e2e2]">Dialog Title</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            This is a description for the dialog. It can contain more detailed information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 flex items-center space-x-2">
          <Checkbox 
            id="dontShowAgainTriggerStory"
            checked={dontShowAgain} 
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            className="border-[#353535] data-[state=checked]:bg-[#C2F751] data-[state=checked]:text-black"
          />
          <Label 
            htmlFor="dontShowAgainTriggerStory" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#e2e2e2]"
          >
            Don't show me this again
          </Label>
        </div>
        
        <DialogFooter className="flex justify-end mt-4">
          <Button 
            onClick={fn()} // Mock action for story
            className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
          >
            Primary Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const WithTriggerAndCustomContent: Story = {
  // No explicit open arg, relies on trigger
  render: DialogWithTriggerComponent,
}; 