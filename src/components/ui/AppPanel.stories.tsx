import type { Meta, StoryObj } from '@storybook/react';
import { AppPanel } from './AppPanel';
import { Button } from './button'; // For example content

const meta: Meta<typeof AppPanel> = {
  title: 'UI/AppPanel',
  component: AppPanel,
  parameters: {
    // layout: 'centered', // Centering might make it hard to see fixed widths relative to viewport
    layout: 'padded', // Padded provides some space around the component
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional classes for the panel (e.g., width like w-[200px] or w-[288px])',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'w-[288px]' }, // Default in args for the first story
      },
    },
    children: {
      control: false, // Children will be provided per story
      description: 'Content to be rendered inside the panel',
    },
    // Spreading other HTMLDivElement props for completeness in argTypes, if desired
    // For example, 'id', 'style', etc., though usually not directly controlled in stories for layout components
  },
  // Optional: Provide a default set of args for all stories if applicable, or per story as below
  // args: {
  //   className: 'w-[288px]', // Example default width if not specified in a story
  // }
};

export default meta;
type Story = StoryObj<typeof AppPanel>;

// Story demonstrating default appearance and common content
export const DefaultPanel: Story = {
  name: 'Default (288px width)',
  args: {
    className: 'w-[288px]',
    children: (
      <>
        <div className="text-sm font-medium text-[#E2E2E5] uppercase self-start">PANEL TITLE</div>
        <p className="text-foreground/80 self-start text-sm">This is some example content inside the panel. The panel uses flex-col and items-start, so direct children will align to the start by default.</p>
        <p className="text-foreground/60 self-start text-xs">Another paragraph of text to show spacing.</p>
        <Button variant="primary" size="default" className="self-start">Action Button</Button>
        <Button variant="primary" size="default" className="w-full">Full Width Button</Button>
      </>
    ),
  },
};

// Story specific for the 200px width
export const Panel200px: Story = {
  name: '200px Width Panel',
  args: {
    className: 'w-[200px]',
    children: (
      <>
        <div className="text-sm font-medium text-white uppercase self-start">COMPACT PANEL</div>
        <p className="text-foreground/80 self-start text-sm">Content for a 200px wide panel. This panel is narrower.</p>
        <Button variant="primary" size="default" className="w-full">Primary Full Width</Button>
      </>
    ),
  },
};

// Story specific for the 288px width (same as Default, but named for clarity if Default changes)
export const Panel288px: Story = {
  name: '288px Width Panel (Explicit)',
  args: {
    className: 'w-[288px]',
    children: (
      <>
        <div className="text-sm font-medium text-white uppercase self-start">STANDARD PANEL</div>
        <p className="text-foreground/80 self-start text-sm">Content for a 288px wide panel. It might have more items or wider items, demonstrating how content flows within the fixed width but variable height.</p>
        <Button variant="primary" className="w-full">Another Full Width</Button>
      </>
    ),
  },
};

// Story to show panel without any explicit width (relies on parent or default browser behavior for div)
export const PanelNoWidth: Story = {
  name: 'Panel (No Explicit Width)',
  args: {
    // className intentionally left blank or set to something not controlling width
    children: (
      <>
        <div className="text-sm font-medium text-white uppercase self-start">FLEXIBLE WIDTH?</div>
        <p className="text-foreground/80 self-start text-sm">This panel has no w- class. Its width will depend on its parent container in the actual app or Storybook's layout settings.</p>
      </>
    ),
  },
}; 