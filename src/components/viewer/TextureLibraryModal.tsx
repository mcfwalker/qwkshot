'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { FloorTexture } from '@/lib/supabase'
import { getTextures, uploadTexture } from '@/lib/texture-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-[#e2e2e2]">Select Texture</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            Choose a texture for the floor or upload a new one.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {/* Upload Form */}
          {showUploadForm && (
            <div className="space-y-4 mb-4 p-4 border border-[#353535] rounded-lg bg-[#121212]">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-md p-4 text-center cursor-pointer
                  ${isDragActive ? 'border-[#C2F751] bg-[#C2F751]/5' : 'border-[#444444]'}
                  ${selectedFile ? 'border-[#C2F751]/50' : ''}
                `}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <p className="text-sm text-[#C2F751]">
                    {selectedFile.name} selected
                  </p>
                ) : (
                  <p className="text-sm text-[#CFD0D0]">
                    {isDragActive ? 'Drop texture here' : 'Drop texture here or click to browse'}
                  </p>
                )}
                <p className="text-xs text-[#666666] mt-2">
                  Max size: 512KB, Formats: JPG, PNG, WebP
                </p>
              </div>

              <Input
                type="text"
                placeholder="Texture name"
                value={textureName}
                onChange={(e) => setTextureName(e.target.value)}
                className="bg-[#121212] border-[#353535]"
              />

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !textureName.trim() || uploading}
                  className="flex-1 bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
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
                  className="flex-1 bg-[#353535] text-[#CFD0D0] hover:bg-[#444444] border-0"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Texture List */}
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-[#CFD0D0] py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading textures...
              </div>
            ) : textures.length === 0 ? (
              <div className="text-center text-[#CFD0D0] py-8">
                No textures in library
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 p-1">
                {textures.map((texture) => (
                  <button
                    key={texture.id}
                    onClick={() => {
                      onSelect(texture)
                      onClose()
                    }}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-[#353535] transition-colors cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <img
                      src={texture.thumbnail_url}
                      alt={texture.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay with name */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                      <span className="text-xs text-white text-center line-clamp-2">
                        {texture.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Add New Texture button at the bottom with 32px gap */}
          {!showUploadForm && (
            <div className="mt-8">
              <Button
                onClick={() => setShowUploadForm(true)}
                className="flex h-[40px] px-6 justify-center items-center self-stretch w-full rounded-md bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90 disabled:opacity-70 disabled:pointer-events-none text-sm"
              >
                Add New Texture
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 