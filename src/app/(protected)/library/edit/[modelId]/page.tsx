import { createServerClient } from '@/lib/supabase-server'
import { ModelEditForm } from '@/components/library/ModelEditForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Mark as dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

async function getModel(modelId: string) {
  const supabase = await createServerClient()
  const { data: model, error } = await supabase
    .from('models')
    .select('*')
    .eq('id', modelId)
    .single()

  if (error || !model) {
    return null
  }

  return model
}

export default async function EditModelPage({
  params
}: {
  params: { modelId: string }
}) {
  const model = await getModel(params.modelId)

  if (!model) {
    notFound()
  }

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <Link href="/library">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Edit Model</h1>
        <ModelEditForm model={model} />
      </div>
    </div>
  )
} 