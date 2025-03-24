import { Skeleton } from '@/components/ui/skeleton'

export function ViewerSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  )
} 