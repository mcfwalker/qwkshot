'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { uploadModel } from '@/lib/library-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Upload } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function UploadPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in')
    }
  }, [user, loading, router])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return null // Will redirect in useEffect
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name) return

    try {
      setUploading(true)
      await uploadModel(file, {
        name,
        description,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        metadata: {
          size: file.size,
          format: file.name.split('.').pop() || 'unknown'
        }
      })
      router.push('/library')
      router.refresh()
    } catch (error) {
      console.error('Error uploading model:', error)
      setUploading(false)
    }
  }

  return (
    <div className="container py-8">
      <Button
        variant="ghost"
        className="mb-8"
        onClick={() => router.push('/library')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Upload New Model</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="file">Model File (GLTF, GLB)</Label>
              <Input
                id="file"
                type="file"
                accept=".gltf,.glb"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., statue, art, historical"
              />
            </div>

            <Button type="submit" disabled={uploading || !file || !name}>
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Model
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 