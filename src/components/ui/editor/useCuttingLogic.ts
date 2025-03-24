import { useCallback, useRef, RefObject, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { EditorMode } from './useMouseHandlers';

interface UseCuttingLogicProps {
  sceneRef: RefObject<THREE.Scene | null>;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  rendererRef: RefObject<THREE.WebGLRenderer | null>;
  controlsRef: RefObject<OrbitControls | null>;
  modelRef: RefObject<THREE.Object3D | null>;
  setError: (error: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
}

export function useCuttingLogic({
  sceneRef,
  cameraRef,
  rendererRef,
  controlsRef,
  modelRef,
  setError,
  setEditorMode
}: UseCuttingLogicProps) {
  const dragControlsRef = useRef<DragControls | null>(null);
  const objectPartsRef = useRef<THREE.Object3D[]>([]);
  const startPointRef = useRef<THREE.Vector3 | null>(null);
  const endPointRef = useRef<THREE.Vector3 | null>(null);
  const isDraggingRef = useRef(false);

  // Perform the cut operation
  const performCut = useCallback(
    (startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
      if (!modelRef.current || !sceneRef.current) {
        setError("Missing model or scene reference");
        return;
      }

      try {
        setError(null);

        // Calculate cutting plane parameters
        const dir = new THREE.Vector3(endPoint.x - startPoint.x, endPoint.y - startPoint.y, 0).normalize();
        const planeNormal = new THREE.Vector3(dir.x, dir.y, 0);
        const cuttingPlane = new THREE.Plane(planeNormal, 0);

        // Find all valid meshes in the model
        const meshes: THREE.Mesh[] = [];
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            meshes.push(child);
          }
        });

        if (meshes.length === 0) {
          setError("No valid meshes found in the model.");
          return;
        }

        // Slice each mesh
        const slicedObjects: THREE.Mesh[] = [];
        meshes.forEach((mesh) => {
          const slicedParts = sliceMesh(mesh, cuttingPlane);
          slicedObjects.push(...slicedParts);
        });

        if (slicedObjects.length === 0) {
          setError("Cutting operation failed. Try cutting at a different angle.");
          return;
        }

        // Remove the original model
        sceneRef.current.remove(modelRef.current);

        // Add the parts to the scene
        slicedObjects.forEach((part) => {
          sceneRef.current!.add(part);
        });

        // Update references
        objectPartsRef.current = slicedObjects;

        // Create drag controls for the parts
        if (dragControlsRef.current) {
          dragControlsRef.current.dispose();
        }

        dragControlsRef.current = new DragControls(
          slicedObjects,
          cameraRef.current!,
          rendererRef.current!.domElement
        );

        // Handle drag control events
        dragControlsRef.current.addEventListener("dragstart", () => {
          if (controlsRef.current) controlsRef.current.enabled = false;
        });

        dragControlsRef.current.addEventListener("dragend", () => {
          if (controlsRef.current) controlsRef.current.enabled = true;
        });

        // Set editor mode to move
        setEditorMode(EditorMode.Move);
      } catch (err) {
        if (err instanceof Error) {
          setError(`Failed to cut the model. Error: ${err.message}`);
        } else {
          setError("Failed to cut the model. An unknown error occurred.");
        }
        console.error("Cutting error:", err);
        // Restore the original model
        if (modelRef.current && sceneRef.current) {
          sceneRef.current.add(modelRef.current);
        }
      }
    },
    [modelRef, sceneRef, cameraRef, rendererRef, controlsRef, setError, setEditorMode]
  );

  // Function to slice the mesh
  const sliceMesh = (mesh: THREE.Mesh, plane: THREE.Plane): THREE.Mesh[] => {
    if (!mesh.geometry) {
      throw new Error("Invalid mesh object");
    }

    // Clone the original material
    let material: THREE.Material | THREE.Material[];
    if (Array.isArray(mesh.material)) {
      material = mesh.material.map(mat => mat.clone());
    } else {
      material = mesh.material.clone();
    }

    // Placeholder function: Implement actual slicing logic with BufferGeometry splitting
    let part1 = new THREE.Mesh(mesh.geometry.clone(), material);
    let part2 = new THREE.Mesh(mesh.geometry.clone(), material);

    part1.position.x -= 1;
    part2.position.x += 1;

    return [part1, part2];
  };

  // Mouse event handlers for cutting
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const mouseVector = new THREE.Vector3(x, y, 0.5);
      mouseVector.unproject(cameraRef.current);

      const dir = mouseVector.sub(cameraRef.current.position).normalize();
      const distance = -cameraRef.current.position.z / dir.z;
      const startPoint = cameraRef.current.position.clone().add(dir.multiplyScalar(distance));

      startPointRef.current = startPoint;
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !startPointRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const mouseVector = new THREE.Vector3(x, y, 0.5);
      mouseVector.unproject(cameraRef.current);

      const dir = mouseVector.sub(cameraRef.current.position).normalize();
      const distance = -cameraRef.current.position.z / dir.z;
      const endPoint = cameraRef.current.position.clone().add(dir.multiplyScalar(distance));

      endPointRef.current = endPoint;
    };

    rendererRef.current?.domElement.addEventListener('mousedown', handleMouseDown);
    rendererRef.current?.domElement.addEventListener('mouseup', handleMouseUp);

    return () => {
      rendererRef.current?.domElement.removeEventListener('mousedown', handleMouseDown);
      rendererRef.current?.domElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [rendererRef, cameraRef]);

  // Function to handle cut button click
  const handleCutButtonClick = useCallback(() => {
    if (startPointRef.current && endPointRef.current) {
      performCut(startPointRef.current, endPointRef.current);
    } else {
      setError("Please select a start and end point for the cut.");
    }
  }, [performCut, setError]);

  // Toggle between view, cut and move modes
  const toggleEditorMode = useCallback((mode: EditorMode) => {
    setEditorMode(mode);

    // Enable/disable appropriate controls
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === EditorMode.View;
    }

    if (dragControlsRef.current) {
      dragControlsRef.current.enabled = mode === EditorMode.Move;

      if (mode === EditorMode.Move && objectPartsRef.current.length > 0) {
        // Re-initialize drag controls with the current parts
        if (dragControlsRef.current) {
          dragControlsRef.current.dispose();
        }

        dragControlsRef.current = new DragControls(
          objectPartsRef.current,
          cameraRef.current!,
          rendererRef.current!.domElement
        );

        dragControlsRef.current.addEventListener("dragstart", () => {
          if (controlsRef.current) controlsRef.current.enabled = false;
        });

        dragControlsRef.current.addEventListener("dragend", () => {
          if (controlsRef.current) controlsRef.current.enabled = true;
        });
      }
    }
  }, [cameraRef, controlsRef, rendererRef, setEditorMode]);

  return {
    performCut,
    toggleEditorMode,
    handleCutButtonClick,
    objectPartsRef
  };
}