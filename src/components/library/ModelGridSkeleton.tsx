import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ModelGridSkeleton() {
  // Create an array of 8 items for the skeleton grid
  return (
    <div className="library-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="library-card overflow-hidden">
          <CardContent className="p-0">
            <Skeleton className="aspect-square" />
          </CardContent>
          <CardFooter className="p-4 flex justify-between">
            <Skeleton className="h-9 w-[60px]" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 