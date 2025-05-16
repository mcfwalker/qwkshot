import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CameraLockSwitch, CameraLockSwitchProps } from './CameraLockSwitch';

const meta: Meta<typeof CameraLockSwitch> = {
  title: 'Viewer/CameraLockSwitch',
  component: CameraLockSwitch,
  tags: ['autodocs'],
  argTypes: {
    isLocked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onLockToggle: { action: 'toggled' },
    label: { control: 'text' },
  },
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'panel',
      values: [
        { name: 'panel', value: '#1D1D1D' }, // Default panel background for context
        { name: 'dark', value: '#000' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '288px' }}> {/* Constrain width similar to ShotCallerPanel */}
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CameraLockSwitch>;

export const Locked: Story = {
  args: {
    isLocked: true,
    disabled: false,
  },
};

export const Unlocked: Story = {
  args: {
    isLocked: false,
    disabled: false,
  },
};

export const DisabledLocked: Story = {
  args: {
    isLocked: true,
    disabled: true,
  },
};

export const DisabledUnlocked: Story = {
  args: {
    isLocked: false,
    disabled: true,
  },
}; 