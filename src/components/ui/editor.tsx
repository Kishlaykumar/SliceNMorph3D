import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Add this interface to define the props
interface EditorProps {
  initialFile?: File;
}

// Update the component to accept the props
const Editor: React.FC<EditorProps> = ({ initialFile }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Three.js related refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) {
      console.error("Canvas ref is null!");
      return;
    }
  
    console.log("Initializing Three.js scene...");
    
    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333); // Darker gray background for visibility
    sceneRef.current = scene;
  
    // Setup camera with better defaults
    const camera = new THREE.PerspectiveCamera(
      60, // FOV
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 5); // Position camera slightly above and back
    cameraRef.current = camera;
  
    // Log dimensions to debug sizing issues
    console.log("Canvas dimensions:", {
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight
    });
  
    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
  
    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;
  
    // Add stronger lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
  
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);
  
    // Add grid helper for reference - bigger and more visible
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    scene.add(gridHelper);
  
    // Add axes helper to show orientation
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
  
    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      
      console.log("Resized canvas:", { width, height });
    };
  
    window.addEventListener('resize', handleResize);
    
    // Force a resize after a short delay to ensure proper initialization
    setTimeout(handleResize, 100);
  
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
  
    animate();
  
    // Cleanup
    return () => {
      console.log("Cleaning up Three.js scene");
      window.removeEventListener('resize', handleResize);
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (canvasRef.current && rendererRef.current) {
        canvasRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Add effect to load the initial file when component mounts
  useEffect(() => {
    if (initialFile && sceneRef.current) {
      loadModel(initialFile);
    }
  }, [initialFile]);

  // Function to load 3D model
  const loadModel = (file: File) => {
    if (!sceneRef.current) return;
    
    setError(null);
    setLoadingProgress(0);
    
    // Remove previous model if exists
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }

    // Create object URL for the file
    const objectUrl = URL.createObjectURL(file);
    
    // Load the model with GLTFLoader
    const loader = new GLTFLoader();
    
    loader.load(
      objectUrl,
      (gltf) => {
        // Success callback
        const model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Normalize model size
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        model.scale.set(scale, scale, scale);
        
        // Center model
        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale;
        model.position.z = -center.z * scale;
        
        // Add model to scene
        sceneRef.current?.add(model);
        modelRef.current = model;
        setModelLoaded(true);
        setLoadingProgress(100);
        
        // Clean up object URL
        URL.revokeObjectURL(objectUrl);
      },
      (progress) => {
        // Progress callback
        if (progress.lengthComputable) {
          const progressPercent = Math.round((progress.loaded / progress.total) * 100);
          setLoadingProgress(progressPercent);
        }
      },
      (error) => {
        // Error callback
        console.error('Error loading model:', error);
        setError('Failed to load the 3D model. Please try a different file.');
        URL.revokeObjectURL(objectUrl);
      }
    );
  };

  return (
    <div className="h-full w-full relative">
      {/* Debug info at the top */}
      <div className="absolute top-0 left-0 bg-black bg-opacity-50 p-2 z-10 text-white text-xs">
        {initialFile ? `File: ${initialFile.name}` : 'No file provided'}
        {modelLoaded ? ' - Model loaded' : ' - Model not loaded'}
      </div>
      
      {/* 3D Canvas */}
      <div 
        ref={canvasRef} 
        className="w-full h-full"
        style={{ position: 'absolute', top: 0, left: 0 }}
      ></div>
      
      {/* Loading indicator */}
      {loadingProgress > 0 && loadingProgress < 100 && (
        <div className="absolute top-4 right-4 bg-gray-800 p-3 rounded-md z-10">
          <p>Loading model: {loadingProgress}%</p>
          <div className="w-full bg-gray-700 h-2 mt-1 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute top-4 right-4 bg-red-800 p-3 rounded-md z-10">
          {error}
        </div>
      )}
      
      {/* Model info overlay */}
      {modelLoaded && (
        <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-75 p-2 rounded-md text-sm z-10">
          <p>Model loaded successfully</p>
          <p className="text-gray-400">Use mouse to orbit, zoom and pan</p>
        </div>
      )}
    </div>
  );
};

export default Editor;