'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Model } from '@/lib/supabase'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[51] w-full max-w-md">
        <div className="bg-black/90 border border-[#444444] rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#444444]">
            <h2 className="text-lg font-light text-white">Select Model</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : models.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No models in library</div>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model)
                      onClose()
                    }}
                    className="w-full text-left p-3 rounded-md hover:bg-white/5 transition-colors group"
                  >
                    <div className="font-medium text-white group-hover:text-[#bef264] transition-colors">
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-sm text-gray-400 mt-1">
                        {model.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Added {new Date(model.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
} 