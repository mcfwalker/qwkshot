import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export const LoadingSpinner = ({
  className,
  size = "default"
}: {
  className?: string
  size?: "small" | "default" | "large"
}) => {
  const sizeClasses = {
    small: "h-4 w-4",
    default: "h-6 w-6",
    large: "h-8 w-8"
  }

  return (
    <Loader2 
      className={cn(
        "animate-spin",
        sizeClasses[size],
        className
      )} 
    />
  )
}

export const LoadingOverlay = ({
  message = "Loading...",
  className
}: {
  message?: string
  className?: string
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/80 backdrop-blur-sm",
      "flex flex-col items-center justify-center gap-4",
      "z-50",
      className
    )}>
      <LoadingSpinner size="large" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

export const LoadingSkeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  )
}

export const LoadingButton = ({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}) => {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        props.className
      )}
    >
      {loading && <LoadingSpinner size="small" />}
      {children}
    </button>
  )
}

export const ModelLoadingSkeleton = () => {
  return (
    <div className="space-y-4 p-4">
      <LoadingSkeleton className="h-8 w-3/4" />
      <LoadingSkeleton className="h-32" />
      <div className="space-y-2">
        <LoadingSkeleton className="h-4 w-1/2" />
        <LoadingSkeleton className="h-4 w-3/4" />
        <LoadingSkeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export const ViewerLoadingSkeleton = () => {
  return (
    <div className="h-full w-full flex">
      {/* Sidebar skeleton */}
      <div className="w-80 border-r border-border p-4 space-y-6">
        <LoadingSkeleton className="h-8 w-3/4" />
        <LoadingSkeleton className="h-[200px]" />
        <LoadingSkeleton className="h-[150px]" />
      </div>
      
      {/* Main viewer area skeleton */}
      <div className="flex-1 relative bg-muted">
        <LoadingSkeleton className="absolute inset-4 rounded-lg" />
      </div>
    </div>
  )
} 