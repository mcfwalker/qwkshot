'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { FloorTexture } from '@/lib/supabase'
import { getTextures, uploadTexture } from '@/lib/texture-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

interface TextureLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (texture: FloorTexture) => void
}

export function TextureLibraryModal({ isOpen, onClose, onSelect }: TextureLibraryModalProps) {
  const [textures, setTextures] = useState<FloorTexture[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [textureName, setTextureName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTextures()
    }
  }, [isOpen])

  const loadTextures = async () => {
    try {
      setLoading(true)
      const data = await getTextures()
      setTextures(data)
    } catch (error) {
      console.error('Error loading textures:', error)
      toast.error('Failed to load textures')
    } finally {
      setLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 512 * 1024, // 512KB
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        setSelectedFile(file)
        // Auto-fill name from file name without extension
        setTextureName(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  })

  const handleUpload = async () => {
    if (!selectedFile || !textureName.trim()) return

    try {
      setUploading(true)
      const texture = await uploadTexture(selectedFile, { name: textureName.trim() })
      setTextures(prev => [texture, ...prev])
      setShowUploadForm(false)
      setSelectedFile(null)
      setTextureName('')
      toast.success('Texture uploaded successfully')
    } catch (error) {
      console.error('Error uploading texture:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload texture')
    } finally {
      setUploading(false)
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
            <h2 className="text-lg font-light text-white">Select Texture</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Upload Button */}
            {!showUploadForm && (
              <Button
                onClick={() => setShowUploadForm(true)}
                variant="secondary"
                className="w-full mb-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add New Texture
              </Button>
            )}

            {/* Upload Form */}
            {showUploadForm && (
              <div className="space-y-4 mb-4 p-4 border border-[#444444] rounded-lg">
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-md p-4 text-center cursor-pointer
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-[#444444]'}
                    ${selectedFile ? 'border-green-500/50' : ''}
                  `}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <p className="text-sm text-green-500">
                      {selectedFile.name} selected
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      {isDragActive ? 'Drop texture here' : 'Drop texture here or click to browse'}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Max size: 512KB, Formats: JPG, PNG, WebP
                  </p>
                </div>

                <Input
                  type="text"
                  placeholder="Texture name"
                  value={textureName}
                  onChange={(e) => setTextureName(e.target.value)}
                  className="bg-transparent border-[#444444]"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || !textureName.trim() || uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowUploadForm(false)
                      setSelectedFile(null)
                      setTextureName('')
                    }}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Texture List */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="text-center text-gray-400 py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading textures...
                </div>
              ) : textures.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No textures in library
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {textures.map((texture) => (
                    <button
                      key={texture.id}
                      onClick={() => {
                        onSelect(texture)
                        onClose()
                      }}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-[#444444] hover:border-[#bef264] transition-colors"
                    >
                      {/* Thumbnail */}
                      <img
                        src={texture.thumbnail_url}
                        alt={texture.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay with name */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <span className="text-sm text-white text-center line-clamp-2">
                          {texture.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 