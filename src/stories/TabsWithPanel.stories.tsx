import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { AppPanel } from '@/components/ui/AppPanel';
import { Button } from '@/components/ui/button';

const TabsWithPanelDemo = ({ initialTab = 'tab1' }: { initialTab?: string }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="p-8 bg-background flex justify-center items-start min-h-screen"> {/* Storybook wrapper, items-start */}
      <AppPanel className="w-[288px] h-[450px] p-0 flex flex-col overflow-hidden"> {/* MODIFIED: Outer AppPanel, p-0, flex-col, fixed height, overflow-hidden */}
        <TabsPrimitive.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 min-h-0 gap-6" // MODIFIED: Added gap-6
        >
          <TabsPrimitive.List className="flex items-center justify-center h-[40px] w-full gap-4 px-4 pt-4 flex-shrink-0"> {/* MODIFIED: Added px-4 pt-4, flex-shrink-0 */}
            <TabsPrimitive.Trigger
              value="tab1"
              className="flex flex-1 h-[40px] px-3 justify-center items-center flex-shrink-0 uppercase text-sm transition-colors text-[rgba(226,226,229,0.48)] hover:text-[rgba(226,226,229,0.84)] data-[state=active]:text-[#E2E2E5] data-[state=active]:border-b data-[state=active]:border-[#CFD0D0]"
            >
              Tab One
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="tab2"
              className="flex flex-1 h-[40px] px-3 justify-center items-center flex-shrink-0 uppercase text-sm transition-colors text-[rgba(226,226,229,0.48)] hover:text-[rgba(226,226,229,0.84)] data-[state=active]:text-[#E2E2E5] data-[state=active]:border-b data-[state=active]:border-[#CFD0D0]"
            >
              Tab Two
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>

          {/* Content Area Wrapper */}
          <div className="flex-1 p-4 overflow-y-auto"> {/* MODIFIED: Wrapper for content with p-4 and scroll */}
            <TabsPrimitive.Content 
              value="tab1" 
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full flex flex-col gap-4" /* MODIFIED: flex, gap, h-full */
            >
              {/* Content directly inside, no nested AppPanel */}
              <div className="text-sm font-medium text-[#E2E2E5] uppercase self-start">PANEL CONTENT FOR TAB ONE</div>
              <p className="text-sm text-muted-foreground flex-grow"> {/* MODIFIED: flex-grow on paragraph for spacing */}
                This is the content for Tab One. It should now appear inside the main panel container,
                respecting the overall padding. We can add more content here to test scrolling.
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
              <Button variant="primary" size="default" className="self-stretch">Action Button 1</Button> {/* MODIFIED: Removed mt-auto, parent is flex-col */}
            </TabsPrimitive.Content>
            <TabsPrimitive.Content 
              value="tab2" 
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full flex flex-col gap-4" /* MODIFIED: flex, gap, h-full */
            >
              {/* Content directly inside, no nested AppPanel */}
              <div className="text-sm font-medium text-[#E2E2E5] uppercase self-start">PANEL CONTENT FOR TAB TWO</div>
              <p className="text-sm text-muted-foreground flex-grow">
                Content for Tab Two. This demonstrates how different content can be displayed,
                also respecting the main panel's padding and integrated tab header.
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
               <Button variant="primary" size="default" className="self-stretch">Action Button 2</Button>
            </TabsPrimitive.Content>
          </div>
        </TabsPrimitive.Root>
      </AppPanel>
    </div>
  );
};

const meta: Meta<typeof TabsWithPanelDemo> = {
  title: 'UI/TabsWithPanel',
  component: TabsWithPanelDemo,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    initialTab: {
      control: 'radio',
      options: ['tab1', 'tab2'],
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TabsWithPanelDemo>;

export const Default: Story = {
  args: {
    initialTab: 'tab1',
  },
};

export const TabTwoActive: Story = {
  args: {
    initialTab: 'tab2',
  },
}; 