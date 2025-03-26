import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  active?: boolean;
}

function Input({ className, type, active, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex w-full rounded-md border border-[#444444] bg-transparent px-3 py-2",
        "text-sm leading-relaxed text-[#6b7280]",
        "placeholder:text-[#6b7280]",
        "hover:border-white focus:border-white focus:outline-none focus:ring-0",
        "focus:placeholder:text-transparent",
        "transition-colors",
        active && "border-white",
        className
      )}
      {...props}
    />
  )
}

export { Input }
