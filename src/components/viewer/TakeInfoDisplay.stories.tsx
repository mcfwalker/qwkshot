import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TakeInfoDisplay } from './TakeInfoDisplay'; // Import the component

const meta: Meta<typeof TakeInfoDisplay> = {
  title: 'Viewer/PlaybackPanel/TakeInfoDisplay',
  component: TakeInfoDisplay,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'panel',
      values: [
        { name: 'panel', value: '#1D1D1D' },
        { name: 'dark', value: '#000' },
      ],
    },
  },
  argTypes: {
    hasCommands: { control: 'boolean' },
    takeCount: { control: 'number' },
    animationName: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '256px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof TakeInfoDisplay>;

export const NoAnimationLoaded: Story = {
  args: {
    hasCommands: false,
    takeCount: 0,
    animationName: null,
  },
};

export const AnimationLoaded: Story = {
  args: {
    hasCommands: true,
    takeCount: 1,
    animationName: 'A Very Long Animation Name That Is Intended To Overflow And Demonstrate The Ellipsis Functionality Correctly',
  },
};

export const AnimationLoadedNoName: Story = {
  args: {
    hasCommands: true,
    takeCount: 2,
    animationName: null, // Will show 'Untitled Shot'
  },
}; 