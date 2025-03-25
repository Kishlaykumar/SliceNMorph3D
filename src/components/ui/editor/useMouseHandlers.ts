import { useState, useCallback, useRef, RefObject, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export enum EditorMode {
  View,
  Cut,
  Move,
}

interface UseMouseHandlersProps {
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
  performCut,
}: UseMouseHandlersProps) {
  const [isCutting, setIsCutting] = useState(false);
  const [cutStartPoint, setCutStartPoint] = useState<THREE.Vector3 | null>(
    null,
  );
  const [cutEndPoint, setCutEndPoint] = useState<THREE.Vector3 | null>(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const cutPlaneRef = useRef<THREE.Mesh | null>(null);
  const cutLineRef = useRef<THREE.Line | null>(null);

  useEffect(() => {
    console.log(EditorMode);
  });

  // Create a visual indicator for the cutting plane
  // const createCutVisualizer = useCallback(
  //   (point: THREE.Vector3) => {
  //     if (!sceneRef.current) return;

  //     // Remove existing visualizers if any
  //     if (cutPlaneRef.current) {
  //       sceneRef.current.remove(cutPlaneRef.current);
  //       cutPlaneRef.current = null;
  //     }
  //     if (cutLineRef.current) {
  //       sceneRef.current.remove(cutLineRef.current);
  //       cutLineRef.current = null;
  //     }

  //     // Create a visible cutting plane
  //     const planeGeometry = new THREE.PlaneGeometry(20, 20);
  //     const planeMaterial = new THREE.MeshBasicMaterial({
  //       color: 0xff0000,
  //       side: THREE.DoubleSide,
  //       transparent: true,
  //       opacity: 0.5,
  //     });
  //     const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  //     plane.position.copy(point);
  //     if (cameraRef.current) {
  //       plane.lookAt(cameraRef.current.position);
  //     }
  //     sceneRef.current.add(plane);
  //     cutPlaneRef.current = plane;

  //     // Create a line to show the drag direction
  //     const lineGeometry = new THREE.BufferGeometry();
  //     const lineMaterial = new THREE.LineBasicMaterial({
  //       color: 0xffffff,
  //       linewidth: 2,
  //     });
  //     const linePoints = [point.clone(), point.clone()];
  //     lineGeometry.setFromPoints(linePoints);
  //     const line = new THREE.Line(lineGeometry, lineMaterial);
  //     sceneRef.current.add(line);
  //     cutLineRef.current = line;
  //   },
  //   [sceneRef, cameraRef]
  // );

  // Update the cutting plane and line visualizers
  const updateCutVisualizer = useCallback(
    (startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
      if (!sceneRef.current) return;
      // Update the line
      if (cutLineRef.current) {
        const lineGeometry = new THREE.BufferGeometry();
        const linePoints = [startPoint.clone(), endPoint.clone()];
        lineGeometry.setFromPoints(linePoints);
        cutLineRef.current.geometry.dispose();
        cutLineRef.current.geometry = lineGeometry;
      }
      // Update the plane
      if (cutPlaneRef.current) {
        const direction = new THREE.Vector3()
          .subVectors(endPoint, startPoint)
          .normalize();
        const midPoint = new THREE.Vector3()
          .addVectors(startPoint, endPoint)
          .multiplyScalar(0.5);
        cutPlaneRef.current.position.copy(midPoint);
        if (cameraRef.current) {
          const cameraUp = cameraRef.current.up.clone();
          let planeNormal = new THREE.Vector3()
            .crossVectors(direction, cameraUp)
            .normalize();
          if (planeNormal.length() < 0.1) {
            const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
              cameraRef.current.quaternion,
            );
            planeNormal = new THREE.Vector3()
              .crossVectors(direction, cameraRight)
              .normalize();
          }
          const target = new THREE.Vector3().addVectors(midPoint, planeNormal);
          cutPlaneRef.current.lookAt(target);
          if (modelRef.current) {
            const box = new THREE.Box3().setFromObject(modelRef.current);
            const size = box.getSize(new THREE.Vector3());
            const maxSize = Math.max(size.x, size.y, size.z) * 2;
            cutPlaneRef.current.scale.set(maxSize, maxSize, 1);
          }
        }
      }
    },
    [sceneRef, cameraRef, modelRef],
  );

  // Function to get 3D position from mouse event
  const get3DPositionFromMouse = useCallback(
    (event: MouseEvent): THREE.Vector3 | null => {
      if (!cameraRef.current || !modelRef.current) return null;
      const canvas = event.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x =
        ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      mouseRef.current.y =
        -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(
        modelRef.current,
        true,
      );
      if (intersects.length > 0) {
        return intersects[0].point.clone();
      } else {
        const vector = new THREE.Vector3(
          mouseRef.current.x,
          mouseRef.current.y,
          0.5,
        );
        vector.unproject(cameraRef.current);
        const dir = vector.sub(cameraRef.current.position).normalize();
        const distance = 10;
        return new THREE.Vector3()
          .copy(cameraRef.current.position)
          .add(dir.multiplyScalar(distance));
      }
    },
    [cameraRef, modelRef],
  );

  // Mouse down handler
  // const handleMouseDown = useCallback((event: MouseEvent) => {
  //   if (editorMode !== EditorMode.Cut) return; // only active in Cut mode
  //   event.preventDefault();
  //   if (controlsRef.current) {
  //     controlsRef.current.enabled = false;
  //   }
  //   const position = get3DPositionFromMouse(event);
  //   if (position) {
  //     setIsCutting(true);
  //     setCutStartPoint(position);
  //     setCutEndPoint(position.clone());
  //     // createCutVisualizer(position);
  //   }
  // }, [editorMode, controlsRef, get3DPositionFromMouse, ]);

  // Mouse move handler
  // const handleMouseMove = useCallback((event: MouseEvent) => {
  //   if (editorMode !== EditorMode.Cut) return;
  //   if (!isCutting || !cutStartPoint) return;
  //   event.preventDefault();
  //   const position = get3DPositionFromMouse(event);
  //   if (position) {
  //     setCutEndPoint(position);
  //     updateCutVisualizer(cutStartPoint, position);
  //   }
  // }, [editorMode, isCutting, cutStartPoint, get3DPositionFromMouse, updateCutVisualizer]);

  // Mouse up handler
  // const handleMouseUp = useCallback((event: MouseEvent) => {
  //   if (editorMode !== EditorMode.Cut) return;
  //   event.preventDefault();
  //   if (controlsRef.current) {
  //     controlsRef.current.enabled = true;
  //   }
  //   if (cutStartPoint && cutEndPoint) {
  //     const distance = cutStartPoint.distanceTo(cutEndPoint);
  //     if (distance > 0.1) {
  //       performCut(cutStartPoint, cutEndPoint);
  //     }
  //   }
  //   setIsCutting(false);
  //   if (sceneRef.current) {
  //     if (cutPlaneRef.current) {
  //       sceneRef.current.remove(cutPlaneRef.current);
  //       cutPlaneRef.current = null;
  //     }
  //     if (cutLineRef.current) {
  //       sceneRef.current.remove(cutLineRef.current);
  //       cutLineRef.current = null;
  //     }
  //   }
  // }, [editorMode, controlsRef, cutStartPoint, cutEndPoint, sceneRef, performCut]);

  // --- Event Listener Setup Effect ---
  // useEffect(() => {
  //   const canvas = canvasRef.current?.querySelector("canvas");
  //   if (!canvas) return;
  //   // Remove existing listeners (capture and bubble phases)
  //   canvas.removeEventListener("mousedown", handleMouseDown, true);
  //   canvas.removeEventListener("mousemove", handleMouseMove, true);
  //   canvas.removeEventListener("mouseup", handleMouseUp, true);
  //   canvas.removeEventListener("mousedown", handleMouseDown, false);
  //   canvas.removeEventListener("mousemove", handleMouseMove, false);
  //   canvas.removeEventListener("mouseup", handleMouseUp, false);
  //   // Attach listeners only in Cut mode
  //   if (editorMode === EditorMode.Cut) {
  //     canvas.addEventListener("mousedown", handleMouseDown, true);
  //     canvas.addEventListener("mousemove", handleMouseMove, true);
  //     canvas.addEventListener("mouseup", handleMouseUp, true);
  //     console.log("Cutting mouse handlers attached");
  //   }
  //   return () => {
  //     canvas.removeEventListener("mousedown", handleMouseDown, true);
  //     canvas.removeEventListener("mousemove", handleMouseMove, true);
  //     canvas.removeEventListener("mouseup", handleMouseUp, true);
  //     canvas.removeEventListener("mousedown", handleMouseDown, false);
  //     canvas.removeEventListener("mousemove", handleMouseMove, false);
  //     canvas.removeEventListener("mouseup", handleMouseUp, false);
  //   };
  // }, [editorMode, handleMouseDown, handleMouseMove, handleMouseUp, canvasRef]);

  // --- Additional Effect to Clear Cutting Visuals When Not in Cut mode ---
  useEffect(() => {
    if (editorMode !== EditorMode.Cut && sceneRef.current) {
      if (cutPlaneRef.current) {
        sceneRef.current.remove(cutPlaneRef.current);
        cutPlaneRef.current = null;
      }
      if (cutLineRef.current) {
        sceneRef.current.remove(cutLineRef.current);
        cutLineRef.current = null;
      }
    }
  }, [editorMode, sceneRef]);

  // Optionally, you can still expose setupMouseEventListeners if needed
  // const setupMouseEventListeners = useCallback(() => {
  //   if (!canvasRef.current) return;
  //   const getCanvasAndSetListeners = () => {
  //     const canvas = canvasRef.current?.querySelector("canvas");
  //     if (!canvas) {
  //       console.warn("Canvas not found, retrying in 100ms");
  //       setTimeout(getCanvasAndSetListeners, 100);
  //       return;
  //     }
  //     // Remove existing listeners in both bubbling and capture phases
  //     canvas.removeEventListener("mousedown", handleMouseDown, false);
  //     canvas.removeEventListener("mousemove", handleMouseMove, false);
  //     canvas.removeEventListener("mouseup", handleMouseUp, false);
  //     canvas.removeEventListener("mousedown", handleMouseDown, true);
  //     canvas.removeEventListener("mousemove", handleMouseMove, true);
  //     canvas.removeEventListener("mouseup", handleMouseUp, true);
  //     // Add listeners ONLY if we're in Cut mode
  //     if (editorMode === EditorMode.Cut) {
  //       setTimeout(() => {
  //         canvas.addEventListener("mousedown", handleMouseDown, true);
  //         canvas.addEventListener("mousemove", handleMouseMove, true);
  //         canvas.addEventListener("mouseup", handleMouseUp, true);
  //         console.log("Added cutting mouse handlers in Cut mode");
  //       }, 10);
  //     } else {
  //       console.log(`In ${editorMode === EditorMode.Move ? "Move" : "View"} mode - cutting handlers disabled`);
  //     }
  //   };
  //   getCanvasAndSetListeners();
  // }, [canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, editorMode]);

  // Clean up cutting visuals on unmount
  // useEffect(() => {
  //   return () => {
  //     if (sceneRef.current) {
  //       if (cutPlaneRef.current) {
  //         sceneRef.current.remove(cutPlaneRef.current);
  //       }
  //       if (cutLineRef.current) {
  //         sceneRef.current.remove(cutLineRef.current);
  //       }
  //     }
  //   };
  // }, [sceneRef]);

  return {
    isCutting,
    cutStartPoint,
    cutEndPoint,
  };
}
