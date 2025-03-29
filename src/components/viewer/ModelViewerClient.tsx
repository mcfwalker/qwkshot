'use client'

import { useEffect, useRef, useState } from 'react'
import { Model } from '@/lib/supabase'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { toast } from 'sonner'
import { loadModel } from '@/lib/library-service'
import { MOUSE } from 'three'

interface ModelViewerClientProps {
  model: Model
}

export function ModelViewerClient({ model }: ModelViewerClientProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  // Get signed URL when component mounts
  useEffect(() => {
    async function getSignedUrl() {
      try {
        const url = await loadModel(model.id)
        setSignedUrl(url)
      } catch (error) {
        console.error('Error getting signed URL:', error)
        toast.error('Failed to load model URL')
      }
    }
    getSignedUrl()
  }, [model.id])

  useEffect(() => {
    if (!containerRef.current || !signedUrl) return

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Set up camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5
    cameraRef.current = camera

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setClearColor(0x000000, 0)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Set up controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN
    }
    controls.enableZoom = true
    controls.listenToKeyEvents(window)
    if (controls.domElement) {
      controls.domElement.addEventListener('wheel', () => {}, { passive: true })
    }
    controlsRef.current = controls

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Load model
    const loader = new GLTFLoader()
    loader.load(
      signedUrl,
      (gltf: GLTF) => {
        scene.add(gltf.scene)

        // Center and scale model
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2 / maxDim
        gltf.scene.scale.multiplyScalar(scale)
        gltf.scene.position.sub(center.multiplyScalar(scale))

        // Update camera
        camera.position.z = 3
        controls.update()
      },
      undefined,
      (err: unknown) => {
        const error = err instanceof Error ? err : new Error('Failed to load model')
        console.error('Error loading model:', error)
        toast.error('Failed to load 3D model')
      }
    )

    // Animation loop
    function animate() {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    function handleResize() {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      scene.clear()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [signedUrl]) // Added signedUrl dependency

  if (!signedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading model...</p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full" />
} 