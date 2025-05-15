import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button'; // Adjust path if your Button component is elsewhere
import { Plus } from 'lucide-react'; // Using a valid icon

// Meta configuration for the Button component
const meta: Meta<typeof Button> = {
  title: 'UI/Button', // How the component will be listed in Storybook
  component: Button,
  parameters: {
    layout: 'centered', // Centers the component in the Storybook canvas
  },
  tags: ['autodocs'], // Enables automatic documentation generation
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'The visual style of the button.',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'The size of the button.',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as a child component, passing props to the first child.',
      defaultValue: false,
    },
    children: {
      control: 'text',
      description: 'The content of the button (text or other elements).',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled.',
      defaultValue: false,
    },
    // You can add more argTypes for other props your button might have
    // e.g., onClick, className, etc.
  },
  args: { // Default args for all stories
    children: 'Button Text',
    disabled: false,
    asChild: false,
  },
};

export default meta;

// Defining a Story type for type safety
type Story = StoryObj<typeof meta>;

// --- Stories ---

// Default/Primary Button Story
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

export const Large: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    children: 'Large Primary Button',
  },
};

export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Small Primary Button',
  },
};

// Example of an Icon Button
// You might need to adjust this based on how icons are used with your Button component
// For example, if icons are passed as children or via a specific prop.
// This example assumes an icon can be passed as a child.
// Note: I used a placeholder icon 'nắm_tay' from lucide-react.
// You should replace this with an actual icon you use, or adjust the story.
export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: (
      <>
        <Plus className="mr-2 h-4 w-4" />
        Button With Icon
      </>
    ),
  },
};

export const IconButton: Story = {
  args: {
    variant: 'outline',
    size: 'icon',
    children: <Plus className="h-4 w-4" />,
  },
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    children: 'Disabled Button',
    disabled: true,
  },
};

// Specific story for the Library button from ModelLoader.tsx
export const LibraryButtonFromModelLoader: Story = {
  args: {
    variant: 'secondary',
    size: 'default',
    children: 'Library',
    // Applying the specific classes seen in ModelLoader.tsx
    // Note: cn() is not used here as these are the final computed classes for this specific instance.
    // In a real app, you'd use cn() if you were conditionally applying classes.
    className: "flex h-[40px] px-6 justify-center items-center gap-[10px] self-stretch rounded-[10px] border border-[#353535] bg-[#121212] hover:bg-[#353535] disabled:opacity-70 disabled:pointer-events-none text-sm text-foreground/80",
  },
};

// Story for a button similar to "Generate Shot"
// This is an approximation, actual implementation might differ
export const GenerateShotButton: Story = {
  args: {
    variant: 'primary', // Assuming it's a primary action
    size: 'lg', // Often generate buttons are larger
    children: 'Generate Shot',
    // Example of adding specific classes if needed, adjust as per actual implementation
    // className: "h-14 rounded-[10px]", 
  },
}; 