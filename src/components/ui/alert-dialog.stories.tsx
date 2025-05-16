import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'; // Assuming this path is correct relative to stories folder or mapped
import { Button } from './button'; // For the trigger

const meta = {
  title: 'UI/AlertDialog',
  component: AlertDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    // Default args for all stories
  },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const commonDialogContent = (
  <AlertDialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535] focus-visible:outline-none ring-0 focus:ring-0">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-[#e2e2e2]">Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription className="text-[#e2e2e2] mt-2">
        This action cannot be undone. This will permanently delete the item
        and remove its data from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="mt-4 flex gap-6 justify-end">
      <AlertDialogCancel
        onClick={fn()}
        className="bg-transparent !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent border-0 shadow-none text-[#e2e2e2] p-0 hover:opacity-70 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={fn()}
        // Based on primary, but with custom colors for this specific alert dialog style
        className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90 h-auto px-4 py-2 min-w-[56px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        Confirm Action
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
);

// Story that is open by default for visual testing
export const DefaultOpen: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  render: (args) => (
    <AlertDialog {...args}>
      {commonDialogContent}
    </AlertDialog>
  ),
};

// Story that uses a trigger
export const WithTrigger: Story = {
  args: {
    onOpenChange: fn(),
  },
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-[#e2e2e2] border-[#353535] hover:bg-[#353535]">Show Alert Dialog</Button>
      </AlertDialogTrigger>
      {commonDialogContent}
    </AlertDialog>
  ),
}; 