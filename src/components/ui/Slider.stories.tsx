import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Slider } from './slider';
import { Label } from './label'; // Assuming Label is in the same directory or accessible

const meta: Meta<typeof Slider> = {
  title: 'UI/Slider',
  component: Slider,
  tags: ['autodocs'],
  argTypes: {
    // Define argTypes for props if needed
  },
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

// Story to replicate the Field of View slider
export const LabeledSliderWithValue: Story = {
  render: (args) => {
    const [value, setValue] = React.useState(args.defaultValue || [50]);

    const handleValueChange = (newValue: number[]) => {
      setValue(newValue);
      if (args.onValueChange) {
        args.onValueChange(newValue);
      }
    };

    return (
      <div className="w-[250px] space-y-3 p-4 bg-[#1D1D1D] rounded-md">
        <div className="flex items-center justify-between">
          <Label htmlFor="fov-slider" className="text-sm font-medium text-[#E2E2E5]">
            FOV
          </Label>
          <span className="text-sm font-medium text-[#E2E2E5]">{value[0]}°</span>
        </div>
        <Slider
          {...args}
          id="fov-slider"
          value={value}
          onValueChange={handleValueChange}
          className="viewer-slider h-2" // Use the viewer-slider class for styling
        />
      </div>
    );
  },
  args: {
    defaultValue: [50],
    max: 120,
    min: 20,
    step: 1,
    // Add other default args if necessary
  },
};

// Basic Slider story
export const Default: Story = {
  args: {
    defaultValue: [33],
    max: 100,
    step: 1,
    className: "w-3/5 viewer-slider h-2", // Added viewer-slider for consistent styling
  },
};

// Slider with custom step
export const CustomStep: Story = {
  args: {
    defaultValue: [25],
    max: 100,
    step: 25,
    className: "w-3/5 viewer-slider h-2",
  },
}; 