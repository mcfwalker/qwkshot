import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { BottomToolbar } from './BottomToolbar'; // Import the component

const meta: Meta<typeof BottomToolbar> = {
  title: 'Viewer/BottomToolbar',
  component: BottomToolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'viewer',
      values: [
        { name: 'viewer', value: '#333333' }, // A dark background similar to the viewer
        { name: 'panel', value: '#1D1D1D' },
      ],
    },
  },
  argTypes: {
    onToggleReticle: { action: 'toggled reticle' },
    isReticleVisible: { control: 'boolean' },
    isReticleLoading: { control: 'boolean' },
    onClearStageReset: { action: 'cleared stage and reset' }, // Required prop
    onCaptureThumbnail: { action: 'captured thumbnail' },
    isModelLoaded: { control: 'boolean' },
    isCapturingThumbnail: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', minHeight: '150px', width: '300px' /* Approximate width of the toolbar plus some padding */ }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof BottomToolbar>;

export const Default: Story = {
  args: {
    onClearStageReset: () => console.log('Clear stage reset clicked'),
    isModelLoaded: true, // Assuming model is loaded for default view
  },
};

export const ReticleHidden: Story = {
  args: {
    ...Default.args,
    isReticleVisible: false,
  },
};

export const ReticleLoading: Story = {
  args: {
    ...Default.args,
    isReticleLoading: true,
  },
};

export const ModelNotLoaded: Story = {
  args: {
    ...Default.args,
    isModelLoaded: false,
  },
};

export const CapturingThumbnail: Story = {
  args: {
    ...Default.args,
    isModelLoaded: true,
    isCapturingThumbnail: true,
  },
};

export const AllButtonsActive: Story = {
  args: {
    onClearStageReset: () => console.log('Clear stage reset clicked'),
    onToggleReticle: () => console.log('Toggle reticle clicked'),
    onCaptureThumbnail: () => console.log('Capture thumbnail clicked'),
    isReticleVisible: true,
    isReticleLoading: false,
    isModelLoaded: true,
    isCapturingThumbnail: false,
  },
}; 