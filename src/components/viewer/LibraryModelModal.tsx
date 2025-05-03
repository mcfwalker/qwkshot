'use client'

import { useState } from 'react'
import { Model } from '@/lib/supabase'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
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
      <DialogContent className="sm:max-w-md bg-[#1D1D1D] border-[#353535]">
        <DialogHeader>
          <DialogTitle>Select Model</DialogTitle>
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
                    className="w-full text-left p-3 rounded-md bg-[#121212] border border-[#353535] hover:border-[#C2F751] transition-colors group"
                  >
                    <div className="font-medium text-[#CFD0D0] group-hover:text-[#C2F751] transition-colors">
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-sm text-[#666666] mt-1">
                        {model.description}
                      </div>
                    )}
                    <div className="text-xs text-[#666666] mt-1">
                      Added {new Date(model.created_at).toLocaleDateString()}
                    </div>
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