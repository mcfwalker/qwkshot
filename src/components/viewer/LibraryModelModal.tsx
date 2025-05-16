'use client'

import { useState } from 'react'
import { Model } from '@/lib/supabase'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

interface LibraryModelModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (model: Model) => void
}

export function LibraryModelModal({ isOpen, onClose, onSelect }: LibraryModelModalProps) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadModels()
    }
  }, [isOpen])

  const loadModels = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setModels(data || [])
    } catch (error) {
      console.error('Error loading models:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-[#e2e2e2]">Select Model</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            Choose a model from your library to load into the viewer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-[#CFD0D0] py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading models...
              </div>
            ) : models.length === 0 ? (
              <div className="text-center text-[#CFD0D0] py-8">
                No models in library
              </div>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model)
                      onClose()
                    }}
                    className="w-full text-left p-3 rounded-md bg-[#2E2E2E] hover:bg-[#343434] transition-colors group cursor-pointer"
                  >
                    <div className="font-medium text-[#e2e2e2] transition-colors">
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-sm text-[#e2e2e2] mt-1">
                        {model.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 