import * as React from "react"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  active?: boolean;
}

function Textarea({ className, active, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full rounded-md border border-[#444444] bg-transparent px-3 py-2",
        "text-sm leading-relaxed",
        "min-h-[140px] resize-none",
        "placeholder:text-gray-500",
        "hover:border-[#CFD0D0] focus:border-[#CFD0D0] focus:outline-none focus:ring-0",
        "focus:placeholder:text-transparent",
        "transition-colors",
        active && "border-[#CFD0D0]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
