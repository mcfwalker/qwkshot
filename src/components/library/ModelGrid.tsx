import { Model } from '@/lib/supabase'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface ModelGridProps {
  models: Model[]
  onEdit?: (model: Model) => void
  onDelete?: (model: Model) => void
}

export function ModelGrid({ models, onEdit, onDelete }: ModelGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {models.map((model) => (
        <Card key={model.id} className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{model.name}</span>
              <div className="flex gap-2">
                {onEdit && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(model)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="icon" onClick={() => onDelete(model)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {model.thumbnail_url ? (
              <img
                src={model.thumbnail_url}
                alt={model.name}
                className="w-full h-48 object-cover rounded-md"
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center">
                No thumbnail
              </div>
            )}
            {model.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {model.description}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Link href={`/viewer/${model.id}`} className="w-full">
              <Button className="w-full">View Model</Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 