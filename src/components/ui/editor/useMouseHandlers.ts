import { useState, useCallback, useRef, RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export enum EditorMode {
  View,
  Cut,
  Move,
}

interface UseMouseHandlersProps {
  // Use the standard React RefObject type
  canvasRef: RefObject<HTMLDivElement>;
  sceneRef: RefObject<THREE.Scene | null>;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: RefObject<OrbitControls | null>;
  modelRef: RefObject<THREE.Object3D | null>;
  editorMode: EditorMode;
  performCut: (startPoint: THREE.Vector3, endPoint: THREE.Vector3) => void;
}

export function useMouseHandlers({
  canvasRef,
  sceneRef,
  cameraRef,
  controlsRef,
  modelRef,
  editorMode,
  performCut
}: UseMouseHandlersProps) {
  // Rest of your code remains the same
  const [isCutting, setIsCutting] = useState(false);
  const [cutStartPoint, setCutStartPoint] = useState<THREE.Vector3 | null>(null);
  const [cutEndPoint, setCutEndPoint] = useState<THREE.Vector3 | null>(null);
  
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const cutPlaneRef = useRef<THREE.Mesh | null>(null);

  // Create a visual indicator for the cutting plane
  const createCutPlaneIndicator = useCallback((point: THREE.Vector3) => {
    if (!sceneRef.current) return;

    // Remove existing plane if any
    if (cutPlaneRef.current) {
      sceneRef.current.remove(cutPlaneRef.current);
    }

    // Create a plane geometry
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.copy(point);

    // Default orientation - will be updated during mouse move
    if (cameraRef.current) {
      plane.lookAt(cameraRef.current.position);
    }

    sceneRef.current.add(plane);
    cutPlaneRef.current = plane;
  }, [sceneRef, cameraRef]);

  // Update the cutting plane indicator
  const updateCutPlaneIndicator = useCallback(
    (startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
      if (!cutPlaneRef.current || !sceneRef.current) return;

      // Calculate the center point of the plane
      const center = new THREE.Vector3()
        .addVectors(startPoint, endPoint)
        .multiplyScalar(0.5);
      cutPlaneRef.current.position.copy(center);

      // Calculate the normal vector to the plane
      const direction = new THREE.Vector3()
        .subVectors(endPoint, startPoint)
        .normalize();
      
      // Use camera's up vector for more consistent results
      const up = cameraRef.current?.up || new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3()
        .crossVectors(direction, up)
        .normalize();

      // If the normal is zero (direction and up are parallel), use a different approach
      if (normal.lengthSq() < 0.001) {
        // Use camera's right vector instead
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
          cameraRef.current?.quaternion || new THREE.Quaternion()
        );
        normal.crossVectors(direction, right).normalize();
      }

      // Set the plane orientation
      cutPlaneRef.current.lookAt(center.clone().add(normal));
    },
    [cameraRef]
  );

  // Mouse down handler
  const handleDOMMouseDown = useCallback(
    (event: MouseEvent) => {
      if (editorMode !== EditorMode.Cut) return;

      event.preventDefault();
      event.stopPropagation();

      const canvas = event.target as HTMLCanvasElement;
      if (
        !canvas ||
        !sceneRef.current ||
        !cameraRef.current ||
        !modelRef.current
      )
        return;

      // Disable orbit controls during cutting
      if (controlsRef.current) controlsRef.current.enabled = false;

      setIsCutting(true);

      // Calculate mouse position
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x =
        ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      mouseRef.current.y =
        -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

      // Raycast to find the intersection point
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(
        modelRef.current,
        true
      );

      if (intersects.length > 0) {
        setCutStartPoint(intersects[0].point.clone());
        createCutPlaneIndicator(intersects[0].point);
      }
    },
    [editorMode, sceneRef, cameraRef, modelRef, controlsRef, createCutPlaneIndicator]
  );

  // Mouse move handler
  const handleDOMMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isCutting || editorMode !== EditorMode.Cut) return;

      event.preventDefault();
      event.stopPropagation();

      const canvas = event.target as HTMLCanvasElement;
      if (
        !canvas ||
        !sceneRef.current ||
        !cameraRef.current ||
        !cutStartPoint ||
        !modelRef.current
      )
        return;

      // Calculate mouse position
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x =
        ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      mouseRef.current.y =
        -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

      // Raycast to find current position
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(
        modelRef.current,
        true
      );

      if (intersects.length > 0) {
        setCutEndPoint(intersects[0].point.clone());
        updateCutPlaneIndicator(cutStartPoint, intersects[0].point);
      }
    },
    [isCutting, editorMode, cutStartPoint, sceneRef, cameraRef, modelRef, updateCutPlaneIndicator]
  );

  // Mouse up handler
  const handleDOMMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!isCutting || editorMode !== EditorMode.Cut) return;

      event.preventDefault();
      event.stopPropagation();

      // Re-enable orbit controls
      if (controlsRef.current) controlsRef.current.enabled = true;

      // Perform the cut if we have valid start and end points
      if (
        cutStartPoint &&
        cutEndPoint &&
        modelRef.current &&
        sceneRef.current
      ) {
        performCut(cutStartPoint, cutEndPoint);
      }

      // Reset cutting state
      setIsCutting(false);
      setCutStartPoint(null);
      setCutEndPoint(null);

      // Remove the cutting plane indicator
      if (cutPlaneRef.current && sceneRef.current) {
        sceneRef.current.remove(cutPlaneRef.current);
        cutPlaneRef.current = null;
      }
    },
    [isCutting, editorMode, cutStartPoint, cutEndPoint, controlsRef, modelRef, sceneRef, performCut]
  );

  // Setup mouse event listeners
  const setupMouseEventListeners = useCallback(() => {
    if (!canvasRef.current) return;

    setTimeout(() => {
      const canvas = canvasRef.current?.querySelector("canvas");
      if (canvas) {
        // Remove existing listeners first
        canvas.removeEventListener("mousedown", handleDOMMouseDown);
        canvas.removeEventListener("mousemove", handleDOMMouseMove);
        canvas.removeEventListener("mouseup", handleDOMMouseUp);

        // Add new listeners
        canvas.addEventListener("mousedown", handleDOMMouseDown);
        canvas.addEventListener("mousemove", handleDOMMouseMove);
        canvas.addEventListener("mouseup", handleDOMMouseUp);
      }
    }, 500);
  }, [canvasRef, handleDOMMouseDown, handleDOMMouseMove, handleDOMMouseUp]);

  return {
    isCutting,
    cutStartPoint,
    cutEndPoint,
    cutPlaneRef,
    setupMouseEventListeners,
    handleDOMMouseDown,
    handleDOMMouseMove,
    handleDOMMouseUp
  };
}