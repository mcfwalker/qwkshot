'use client'

import { useEffect, useRef, useState } from 'react'
import { Model } from '@/lib/supabase'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { toast } from 'sonner'
import { loadModel } from '@/lib/library-service'
import { MOUSE } from 'three'
import { useViewerStore } from '@/store/viewerStore'

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
  const setModelVerticalOffset = useViewerStore((s) => s.setModelVerticalOffset)

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
    let currentModel: THREE.Object3D | null = null;
    loader.load(
      signedUrl,
      (gltf: GLTF) => {
        /* ───────────────────────────  CLEAN‑UP PREVIOUS MODEL  ─────────────────────────── */
        if (currentModel) {
          scene.remove(currentModel)
          currentModel.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.geometry?.dispose()
              if (Array.isArray(c.material)) c.material.forEach(m => m.dispose())
              else c.material?.dispose()
            }
          })
        }
        
        /* ─────────────────────────────  NORMALISE NEW MODEL  ───────────────────────────── */
        // 0.  Wrap everything in a container we control
        const container = new THREE.Group()
        container.add(gltf.scene)
        scene.add(container)
        currentModel = container
    
        // 1.  Initial box → scale so longest edge == 2 units
        const box1   = new THREE.Box3().setFromObject(container)
        const size1  = box1.getSize(new THREE.Vector3())
        const scale  = size1.length() > 0 ? 2 / Math.max(size1.x, size1.y, size1.z) : 1
        container.scale.setScalar(scale)
    
        // 2.  Recompute box after scaling
        const box2  = new THREE.Box3().setFromObject(container)
    
        // 3.  Translate: centre X‑Z, lift so bottom rests on y = 0
        const offsetX = -(box2.max.x + box2.min.x) / 2
        const offsetY = -box2.min.y                         // already scaled
        const offsetZ = -(box2.max.z + box2.min.z) / 2
        container.position.set(0, offsetY, 0);

        // 4.  Persist unscaled vertical offset for metadata
        const unscaledOffsetY = offsetY / scale
        useViewerStore.getState().setModelVerticalOffset(unscaledOffsetY)
    
        // 5. Frame camera based on the final positioned object
        const box3  = new THREE.Box3().setFromObject(container)      // final box
        const center = box3.getCenter(new THREE.Vector3());
        const size = box3.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const camDist = box3.getSize(new THREE.Vector3()).length() * 1.5

        // Position camera relative to the center
        camera.position.copy(center);
        camera.position.z += Math.max(maxDim * 1.5, 3); // Adjust distance based on size, ensure minimum
        camera.lookAt(center); // Ensure camera looks at the object center

        // Update controls target to the object center
        controls.target.copy(center);
        controls.update()
    
        // Grounding confirmed via debugger. Logging removed.
      },
      undefined,
      (err) => {
        console.error('Failed to load model:', err)
        toast.error('Failed to load 3D model')
      }
    )

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      // Log container position just before rendering each frame
      if (sceneRef.current && currentModel) {
        const worldPos = currentModel.getWorldPosition(new THREE.Vector3());
        // console.log('>>> Animate Loop - Container World Y:', worldPos.y.toFixed(4)); // Keep previous log commented for now
      }

      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
      renderer.dispose();
      scene.clear();
      containerRef.current?.removeChild(renderer.domElement);
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