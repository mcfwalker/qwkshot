import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full rounded-md border border-[#444444] bg-transparent px-3 py-2",
        "text-sm leading-relaxed",
        "min-h-[140px] resize-none",
        "placeholder:text-gray-500",
        "hover:border-white focus:border-white focus:outline-none focus:ring-0",
        "focus:placeholder:text-transparent",
        "transition-colors",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
