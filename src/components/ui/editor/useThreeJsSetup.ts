import { useRef, useEffect, useState, RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// Change the parameter type to match React's RefObject
export function useThreeJsSetup(canvasRef: RefObject<HTMLDivElement>) {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Always check if canvasRef.current exists before using it
    if (!canvasRef.current) return;

    // Clean up canvas
    while (canvasRef.current.firstChild) {
      canvasRef.current.removeChild(canvasRef.current.firstChild);
    }

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    sceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      60,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      canvasRef.current.clientWidth,
      canvasRef.current.clientHeight,
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 20;
    controls.zoomSpeed = 1.0;
    controls.screenSpacePanning = true;
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = (Math.PI * 5) / 6;
    controlsRef.current = controls;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);

    // Add reference grid and axes
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current)
        return;

      if (canvasRef.current) {
        // Safe to use canvasRef.current here
        const width = canvasRef.current.clientWidth;
        // ...

        const height = canvasRef.current.clientHeight;

        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener("resize", handleResize);
    setTimeout(handleResize, 100);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    setIsInitialized(true);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);

      if (controlsRef.current) controlsRef.current.dispose();
      if (rendererRef.current) rendererRef.current.dispose();

      if (canvasRef.current) {
        while (canvasRef.current.firstChild) {
          canvasRef.current.removeChild(canvasRef.current.firstChild);
        }
      }
    };
  }, []);

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    isInitialized,
  };
}
