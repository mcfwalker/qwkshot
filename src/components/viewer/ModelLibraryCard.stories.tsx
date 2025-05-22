import type { Meta, StoryObj } from '@storybook/react';
import ModelLibraryCard from './ModelLibraryCard';

const meta: Meta<typeof ModelLibraryCard> = {
  title: 'Viewer/ModelLibraryCard',
  component: ModelLibraryCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    modelName: {
      control: 'text',
      description: 'The name of the model',
    },
    thumbnailUrl: {
      control: 'text',
      description: 'URL for the model thumbnail image',
    },
    onClick: { action: 'clicked' },
    onEditClick: { action: 'editClicked' },
  },
  decorators: [
    (Story) => (
      <div style={{ /* width: '300px' */ }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    modelName: 'My Awesome Model',
    thumbnailUrl: 'https://via.placeholder.com/300x150?text=Model+Thumbnail',
    onClick: () => console.log('Card clicked'),
    onEditClick: () => console.log('Edit button clicked'),
  },
};

export const WithoutThumbnail: Story = {
  args: {
    modelName: 'Model Without Image',
    onClick: () => console.log('Card clicked'),
    onEditClick: () => console.log('Edit button clicked'),
  },
};

export const LongName: Story = {
  args: {
    modelName: 'This is a Very Long Model Name That Should Be Truncated Nicely',
    thumbnailUrl: 'https://via.placeholder.com/300x150?text=Model+Thumbnail',
    onClick: () => console.log('Card clicked'),
    onEditClick: () => console.log('Edit button clicked'),
  },
}; 