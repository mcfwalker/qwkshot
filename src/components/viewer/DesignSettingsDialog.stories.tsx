import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DesignSettingsDialog } from './DesignSettingsDialog';

const meta: Meta<typeof DesignSettingsDialog> = {
  title: 'Components/Viewer/DesignSettingsDialog',
  component: DesignSettingsDialog,
  tags: ['autodocs'],
  argTypes: {
    isOpen: { control: 'boolean' },
    canvasBackgroundColor: { control: 'color' },
    gridVisible: { control: 'boolean' },
    gridColor: { control: 'color' },
  },
  parameters: {
    layout: 'centered', // Centers the component in the Canvas
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

// Story that manages its own state to allow interaction with the dialog
const InteractiveDialogStory: Story = {
  render: (args) => {
    // Use React hooks to manage the state for the dialog's props
    const [isOpen, setIsOpen] = useState(args.isOpen);
    const [canvasBackgroundColor, setCanvasBackgroundColor] = useState(args.canvasBackgroundColor);
    const [gridVisible, setGridVisible] = useState(args.gridVisible);
    const [gridColor, setGridColor] = useState(args.gridColor);

    // Update args when state changes, if needed by Storybook controls
    // This might not be strictly necessary for all controls if they directly manipulate state
    // but ensures Storybook's controls panel reflects the current state.
    args.isOpen = isOpen;
    args.canvasBackgroundColor = canvasBackgroundColor;
    args.gridVisible = gridVisible;
    args.gridColor = gridColor;

    return (
      <DesignSettingsDialog
        {...args}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        canvasBackgroundColor={canvasBackgroundColor}
        onCanvasBackgroundColorChange={setCanvasBackgroundColor}
        gridVisible={gridVisible}
        onGridVisibleChange={setGridVisible}
        gridColor={gridColor}
        onGridColorChange={setGridColor}
      />
    );
  },
  args: {
    isOpen: true,
    canvasBackgroundColor: '#121212',
    gridVisible: true,
    gridColor: '#444444',
  },
};

export const DefaultOpen: Story = { ...InteractiveDialogStory };

export const InitiallyClosed: Story = {
  ...InteractiveDialogStory,
  args: {
    ...InteractiveDialogStory.args, // Inherit default colors and grid visibility
    isOpen: false,
  },
  // To demonstrate opening it, you might need a button in the story if not using controls
  // For now, assumes opening via Storybook controls panel.
};

export const GridDisabled: Story = {
  ...InteractiveDialogStory,
  args: {
    ...InteractiveDialogStory.args,
    isOpen: true,
    gridVisible: false,
  },
};

// Example of how to add a button to trigger the dialog if needed for non-control based interaction
const StoryWithButton: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false); // Starts closed
    const [canvasBackgroundColor, setCanvasBackgroundColor] = useState(args.canvasBackgroundColor);
    const [gridVisible, setGridVisible] = useState(args.gridVisible);
    const [gridColor, setGridColor] = useState(args.gridColor);

    return (
      <>
        <button 
          onClick={() => setIsOpen(true)} 
          style={{ marginBottom: '10px', padding: '8px 12px', cursor: 'pointer' }}
        >
          Open Design Settings
        </button>
        <DesignSettingsDialog
          {...args}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          canvasBackgroundColor={canvasBackgroundColor}
          onCanvasBackgroundColorChange={setCanvasBackgroundColor}
          gridVisible={gridVisible}
          onGridVisibleChange={setGridVisible}
          gridColor={gridColor}
          onGridColorChange={setGridColor}
        />
      </>
    );
  },
  args: {
    // isOpen is managed internally, so not needed in args here
    canvasBackgroundColor: '#333333',
    gridVisible: true,
    gridColor: '#555555',
  }
};

export const WithTriggerButton: Story = { ...StoryWithButton }; 