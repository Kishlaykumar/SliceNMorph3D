import { useCallback, useRef, RefObject, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { EditorMode } from './useMouseHandlers';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';


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
  // The activeObjectsRef will store all objects that can be cut
  const activeObjectsRef = useRef<THREE.Mesh[]>([]);
  const dragControlsRef = useRef<DragControls | null>(null);
  const objectPartsRef = useRef<THREE.Object3D[]>([]);
  const cuttingPlaneHelperRef = useRef<THREE.PlaneHelper | null>(null);
  const cameraPositionBeforeCutRef = useRef<THREE.Vector3 | null>(null);
  const cameraTargetBeforeCutRef = useRef<THREE.Vector3 | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const originalModelRef = useRef<THREE.Object3D | null>(null);
  const cutCountRef = useRef<number>(0);
  const editorModeRef = useRef<EditorMode>(EditorMode.View);
  const mouseStartPointRef = useRef<THREE.Vector3 | null>(null);
  const mouseEndPointRef = useRef<THREE.Vector3 | null>(null);
  // Add these refs at the top of your useCuttingLogic function
const selectedPartRef = useRef<THREE.Object3D | null>(null);
const originalMaterialsRef = useRef<Map<THREE.Object3D, THREE.Material | THREE.Material[]>>(new Map());
const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());



  const cloneMaterial = (material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] => {
    if (Array.isArray(material)) {
      return material.map(mat => mat.clone());
    } else {
      return material.clone();
    }
  };

  const setupDragControls = useCallback((objects: THREE.Object3D[]) => {
    if (!cameraRef.current || !rendererRef.current) return;
    
    if (dragControlsRef.current) {
      dragControlsRef.current.dispose();
    }

    dragControlsRef.current = new DragControls(
      objects,
      cameraRef.current,
      rendererRef.current.domElement
    );

    dragControlsRef.current.addEventListener("dragstart", () => {
      if (controlsRef.current) controlsRef.current.enabled = false;
    });

    dragControlsRef.current.addEventListener("dragend", () => {
      if (controlsRef.current) controlsRef.current.enabled = true;
    });
  }, [cameraRef, rendererRef, controlsRef]);

  const finalizeGroupCut = useCallback((part1Group: THREE.Group, part2Group: THREE.Group) => {
  try {
    if (!sceneRef.current || !modelRef.current) {
      throw new Error("Missing scene or model reference");
    }

    if (part1Group.children.length === 0 || part2Group.children.length === 0) {
      throw new Error("Cutting failed - one of the parts is empty. Try a different cut angle.");
    }

    // Clear any existing parts first to prevent duplicate objects
    objectPartsRef.current.forEach(part => {
      if (part.parent) {
        part.parent.remove(part);
      }
    });
    objectPartsRef.current = [];

    // Make sure the original model is completely removed from the scene
    // First remove it directly
    if (modelRef.current.parent) {
      modelRef.current.parent.remove(modelRef.current);
    }
    
    // Then traverse the scene to find and remove any other instances
    // (This is a safety check to ensure no remnants remain)
    sceneRef.current.traverse((object) => {
      if (object !== part1Group && object !== part2Group && 
          object instanceof THREE.Mesh && 
          object.userData.isOriginalModel) {
        if (object.parent) {
          object.parent.remove(object);
        }
      }
    });

    // Mark all original model objects for easier identification
    modelRef.current.traverse((child) => {
      child.userData.isOriginalModel = true;
    });

    // Get original model bounds and scale for reference
    const originalBox = new THREE.Box3().setFromObject(modelRef.current);
    const originalSize = new THREE.Vector3();
    originalBox.getSize(originalSize);

    // Reset positions
    part1Group.position.set(0, 0, 0);
    part2Group.position.set(0, 0, 0);

    // Ensure the scale is correct - explicitly set world matrix
    part1Group.matrix.copy(modelRef.current.matrix.clone());
    part2Group.matrix.copy(modelRef.current.matrix.clone());
    part1Group.matrixAutoUpdate = false;
    part2Group.matrixAutoUpdate = false;

    // Re-enable matrix auto-update for positioning
    part1Group.matrixAutoUpdate = true;
    part2Group.matrixAutoUpdate = true;

    // Calculate centers for separation
    const box1 = new THREE.Box3().setFromObject(part1Group);
    const box2 = new THREE.Box3().setFromObject(part2Group);
    const center1 = new THREE.Vector3();
    const center2 = new THREE.Vector3();
    box1.getCenter(center1);
    box2.getCenter(center2);

    // Create separation between parts
    const separationDir = new THREE.Vector3().subVectors(center1, center2).normalize();
    
    // Use a larger offset for better visual separation
    const OFFSET = Math.max(0.5, originalSize.length() * 0.1);
    
    part1Group.position.add(separationDir.clone().multiplyScalar(OFFSET));
    part2Group.position.add(separationDir.clone().multiplyScalar(-OFFSET));

    // Safety check for oversized parts
    const part1Box = new THREE.Box3().setFromObject(part1Group);
    const part2Box = new THREE.Box3().setFromObject(part2Group);
    const part1Size = new THREE.Vector3();
    const part2Size = new THREE.Vector3();
    part1Box.getSize(part1Size);
    part2Box.getSize(part2Size);

    if (part1Size.length() > originalSize.length() * 1.5) {
      const scaleFactor = originalSize.length() / part1Size.length();
      part1Group.scale.multiplyScalar(scaleFactor);
    }
    
    if (part2Size.length() > originalSize.length() * 1.5) {
      const scaleFactor = originalSize.length() / part2Size.length();
      part2Group.scale.multiplyScalar(scaleFactor);
    }

    // Add parts to scene and update references
    sceneRef.current.add(part1Group);
    sceneRef.current.add(part2Group);
    objectPartsRef.current = [part1Group, part2Group];
    cutCountRef.current++;

    setupDragControls([part1Group, part2Group]);
    
    // Clear any previous selection
    selectedPartRef.current = null;
    originalMaterialsRef.current.clear();
    
    setEditorMode(EditorMode.Move);

    setTimeout(() => {
      isProcessingRef.current = false;
      setError(`Cut complete! The model has been divided into 2 parts.`);
      setTimeout(() => setError(null), 3000);
    }, 300);

  } catch (err) {
    isProcessingRef.current = false;
    if (err instanceof Error) {
      setError(`Cut failed: ${err.message}`);
    } else {
      setError("Cut failed: Unknown error");
    }
    console.error("Cut error:", err);
  }
}, [sceneRef, modelRef, setEditorMode, setupDragControls, setError]);

  // Add the click handler to document in an effect
 // Modified useEffect without the circular dependency
useEffect(() => {
  // Only add click handler when in move mode and after cutting
  if (editorModeRef.current === EditorMode.Move && cutCountRef.current > 0) {
    document.addEventListener('click', handleModelClick);
    
    return () => {
      document.removeEventListener('click', handleModelClick);
    };
  }
}, [editorModeRef.current, cutCountRef.current]); // Remove handleModelClick from dependencies


  const performCut = useCallback(() => {
    if (editorModeRef.current !== EditorMode.Cut) {
      console.log("Cut operation ignored - not in Cut mode");
      return;
    }
    
    if (!sceneRef.current || !modelRef.current || isProcessingRef.current) {
      setError(isProcessingRef.current ? "Already processing a cut operation" : "Missing scene or model reference");
      return;
    }
  
    const startPoint = mouseStartPointRef.current;
    const endPoint = mouseEndPointRef.current;
  
    if (!startPoint || !endPoint) {
      setError("Invalid cutting points");
      return;
    }
  
    const distance = startPoint.distanceTo(endPoint);
    if (distance < 0.1) {
      console.log("Cut operation ignored - points too close");
      return;
    }
  
    // Prevent multiple cuts
    if (cutCountRef.current > 0) {
      setError("Model can only be cut once.");
      setEditorMode(EditorMode.Move);
      return;
    }
  
    // Create the cutting plane using the points from mouse interactions
    const dir = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const cuttingPlane = new THREE.Plane();
    const modelCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(modelRef.current).getCenter(modelCenter);
    cuttingPlane.setFromNormalAndCoplanarPoint(dir, modelCenter);
  
    // The red cutting plane visualization is already handled during mousemove
    // through the updateCuttingPlanePreview function
  
    isProcessingRef.current = true;
    setError("Processing cut operation...");
  
    const part1Group = new THREE.Group();
    const part2Group = new THREE.Group();
    part1Group.name = "Part1";
    part2Group.name = "Part2";
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const meshes: THREE.Mesh[] = [];
          modelRef.current!.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              meshes.push(child);
            }
          });
  
          if (meshes.length === 0) {
            setError("No valid meshes found in the model.");
            isProcessingRef.current = false;
            return;
          }
  
          let processedCount = 0;
          const totalMeshes = meshes.length;
  
          const processMesh = (index: number) => {
            if (index >= totalMeshes) {
              finalizeGroupCut(part1Group, part2Group);
              
              // After finalizing the cut, remove the cutting plane helper
              if (cuttingPlaneHelperRef.current && sceneRef.current) {
                sceneRef.current.remove(cuttingPlaneHelperRef.current);
                cuttingPlaneHelperRef.current = null;
              }
              
              // Automatically switch to move mode after cutting
              editorModeRef.current = EditorMode.Move;
              setEditorMode(EditorMode.Move);
              
              return;
            }
  
            const mesh = meshes[index];
            try {
              // Create plane geometry for cutting
              const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
              const planeMesh = new THREE.Mesh(planeGeometry);
              planeMesh.lookAt(cuttingPlane.normal);
              planeMesh.position.copy(modelCenter);
              planeMesh.updateMatrixWorld();
              
              // CSG operations
              const meshBrush = new Brush(mesh.geometry);
              meshBrush.updateMatrixWorld();
              
              const planeBrush = new Brush(planeGeometry);
              planeBrush.matrix.copy(planeMesh.matrix);
              planeBrush.updateMatrixWorld();
              
              // Use a shared evaluator
              const evaluator = new Evaluator();
              
              // Perform CSG operations to get two parts
              const part1Brush = evaluator.evaluate(meshBrush, planeBrush, SUBTRACTION);
              const part2Brush = evaluator.evaluate(meshBrush, planeBrush, INTERSECTION);
              
              // Clone material
              const clonedMaterial = cloneMaterial(mesh.material);
              
              // Create new meshes for the parts
              const part1 = new THREE.Mesh(part1Brush.geometry, clonedMaterial);
              const part2 = new THREE.Mesh(part2Brush.geometry, clonedMaterial);
              
              // Apply transformations
              part1.matrix.copy(mesh.matrix.clone());
              part2.matrix.copy(mesh.matrix.clone());
              part1.matrixAutoUpdate = false;
              part2.matrixAutoUpdate = false;
              
              // Add the parts to their respective groups
              part1Group.add(part1);
              part2Group.add(part2);
              
              processedCount++;
              setError(`Processing cut: ${Math.round((processedCount / totalMeshes) * 100)}%`);
              
              // Process next mesh in the next frame to avoid freezing
              requestAnimationFrame(() => processMesh(index + 1));
            } catch (err) {
              console.error(`Error processing mesh ${index}:`, err);
              // Skip problematic mesh and continue
              requestAnimationFrame(() => processMesh(index + 1));
            }
          };
  
          processMesh(0);
  
        } catch (err) {
          if (err instanceof Error) {
            setError(`Failed to cut model: ${err.message}`);
          } else {
            setError("Failed to cut model: Unknown error");
          }
          isProcessingRef.current = false;
        }
      }, 100);
    });
  }, [modelRef, sceneRef, setError, finalizeGroupCut, setEditorMode]);
  

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (editorModeRef.current !== EditorMode.Cut) return;
  
    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect) return;
  
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
    const mouseVector = new THREE.Vector3(x, y, 0.5);
    mouseVector.unproject(cameraRef.current!);
    mouseVector.sub(cameraRef.current!.position).normalize();
  
    const distance = -cameraRef.current!.position.z / mouseVector.z;
    const startPoint = cameraRef.current!.position.clone().add(mouseVector.multiplyScalar(distance));
  
    mouseStartPointRef.current = startPoint;
  
    // Add mouse move event listener when mouse down occurs
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
    }
  }, [cameraRef, rendererRef]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (editorModeRef.current !== EditorMode.Cut || !mouseStartPointRef.current) return;
  
    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect) return;
  
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
    const mouseVector = new THREE.Vector3(x, y, 0.5);
    mouseVector.unproject(cameraRef.current!);
    mouseVector.sub(cameraRef.current!.position).normalize();
  
    const distance = -cameraRef.current!.position.z / mouseVector.z;
    const currentPoint = cameraRef.current!.position.clone().add(mouseVector.multiplyScalar(distance));
  
    // Update the cutting plane preview in real-time
    updateCuttingPlanePreview(mouseStartPointRef.current, currentPoint);
  }, [cameraRef, rendererRef]);
  
  const updateCuttingPlanePreview = useCallback((startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
    if (!sceneRef.current || !modelRef.current) return;
  
    // Create the cutting plane
    const dir = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const cuttingPlane = new THREE.Plane();
    const modelCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(modelRef.current).getCenter(modelCenter);
    cuttingPlane.setFromNormalAndCoplanarPoint(dir, modelCenter);
  
    // Remove existing plane helper if it exists
    if (cuttingPlaneHelperRef.current) {
      sceneRef.current.remove(cuttingPlaneHelperRef.current);
    }
  
    // Create a new PlaneHelper with red color
    const box = new THREE.Box3().setFromObject(modelRef.current);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z) * 1.5;
  
    const planeHelper = new THREE.PlaneHelper(cuttingPlane, maxDimension, 0xff0000);
    sceneRef.current.add(planeHelper);
    cuttingPlaneHelperRef.current = planeHelper;
  }, [sceneRef, modelRef]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (editorModeRef.current !== EditorMode.Cut) return;
  
    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect) return;
  
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
    const mouseVector = new THREE.Vector3(x, y, 0.5);
    mouseVector.unproject(cameraRef.current!);
    mouseVector.sub(cameraRef.current!.position).normalize();
  
    const distance = -cameraRef.current!.position.z / mouseVector.z;
    const endPoint = cameraRef.current!.position.clone().add(mouseVector.multiplyScalar(distance));
  
    mouseEndPointRef.current = endPoint;
  
    // Remove the mousemove event listener
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.removeEventListener("mousemove", handleMouseMove);
    }
  
    // Instead of immediately performing the cut, ask for confirmation
    const confirmCut = window.confirm("Proceed with cut at the red plane?");
    if (confirmCut) {
      performCut();
    }
  }, [cameraRef, rendererRef, performCut]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mouseup", handleMouseUp);
    }
  
    return () => {
      if (canvas) {
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [handleMouseDown, handleMouseUp, handleMouseMove, rendererRef]);

  const handleModelClick = useCallback((event: MouseEvent) => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
    
    const canvas = rendererRef.current.domElement;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Set up raycaster
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // Get all objects to check for intersection
    const objectsToCheck = objectPartsRef.current;
    
    // Check for intersections
    const intersects = raycasterRef.current.intersectObjects(objectsToCheck, true);
    
    // Reset previously selected part color if any
    if (selectedPartRef.current) {
      const originalMaterial = originalMaterialsRef.current.get(selectedPartRef.current);
      if (originalMaterial) {
        // Restore original material
        selectedPartRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = originalMaterial instanceof THREE.Material 
              ? originalMaterial.clone() 
              : originalMaterial.map(m => m.clone());
          }
        });
      }
      selectedPartRef.current = null;
    }
    
    // If we clicked on a part, highlight it
    if (intersects.length > 0) {
      // Find the parent part group that was clicked
      let clickedPart = intersects[0].object;
      while (clickedPart.parent && !objectPartsRef.current.includes(clickedPart)) {
        clickedPart = clickedPart.parent;
      }
      
      if (objectPartsRef.current.includes(clickedPart)) {
        // Store the selected part
        selectedPartRef.current = clickedPart;
        
        // Store original materials if not already stored
        if (!originalMaterialsRef.current.has(clickedPart)) {
          clickedPart.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              originalMaterialsRef.current.set(clickedPart, child.material);
            }
          });
        }
        
        // Apply blue material to highlight
        const blueMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x0088ff,
          roughness: 0.5,
          metalness: 0.5
        });
        
        clickedPart.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = blueMaterial;
          }
        });
        
        // Log the clicked model
        console.log('Selected part:', clickedPart);
      }
    }
  }, [cameraRef, rendererRef, sceneRef, objectPartsRef]);

  const toggleEditorMode = useCallback((mode: EditorMode) => {
    const prevMode = editorModeRef.current;
    
    if (prevMode === EditorMode.Cut && mode !== EditorMode.Cut) {
      // Clear cutting visualizations if leaving Cut mode
      if (cuttingPlaneHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(cuttingPlaneHelperRef.current);
        cuttingPlaneHelperRef.current = null;
      }
    }
    
    if (mode === EditorMode.Cut && cutCountRef.current > 0) {
      setError("Model can only be cut once. Use Reset if you want to cut again.");
      editorModeRef.current = EditorMode.Move;
      setEditorMode(EditorMode.Move);
      if (objectPartsRef.current.length > 0) {
        setupDragControls(objectPartsRef.current);
      }
      return;
    }
    
    editorModeRef.current = mode;
    setEditorMode(mode);
    
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === EditorMode.View;
    }
    
    if (mode === EditorMode.Move && objectPartsRef.current.length > 0) {
      setupDragControls(objectPartsRef.current);
      
      // Add model click handler if we have cut parts and are in move mode
      if (cutCountRef.current > 0) {
        document.addEventListener('click', handleModelClick);
      }
    } else {
      // Remove model click handler if not in move mode
      document.removeEventListener('click', handleModelClick);
    }
  }, [controlsRef, setEditorMode, setupDragControls, setError, handleModelClick]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
      }
    };
  }, [handleMouseDown, handleMouseUp, rendererRef]);

  const exportSelectedPart = useCallback(() => {
    if (!selectedPartRef.current) {
      setError("No part selected. Please click on a part to select it first.");
      return;
    }
  
    // Use GLTFExporter to export the selected part
    const exporter = new GLTFExporter();
    const options = {
      binary: true, // Set to true for .glb, false for .gltf
      animations: [],
      onlyVisible: true
    };
  
    try {
      exporter.parse(
        selectedPartRef.current,
        (result) => {
          const output = result instanceof ArrayBuffer
            ? new Blob([result], { type: 'application/octet-stream' })
            : new Blob([JSON.stringify(result)], { type: 'text/plain' });
  
          // Create download link
          const downloadLink = document.createElement('a');
          const partName = selectedPartRef.current?.name || 'part';
          const extension = result instanceof ArrayBuffer ? 'glb' : 'gltf';
          downloadLink.href = URL.createObjectURL(output);
          downloadLink.download = `${partName}_export.${extension}`;
          
          // Add to document, click, and remove
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Clean up URL object
          setTimeout(() => {
            URL.revokeObjectURL(downloadLink.href);
            setError(`Successfully exported ${partName}.`);
            setTimeout(() => setError(null), 3000);
          }, 100);
        },
        (error) => {
          console.error('Error exporting model:', error);
          setError(`Export failed: ${error.message || 'Unknown error'}`);
        },
        options
      );
    } catch (err) {
      console.error('Error during export:', err);
      if (err instanceof Error) {
        setError(`Export failed: ${err.message}`);
      } else {
        setError("Export failed: Unknown error");
      }
    }
  }, [selectedPartRef, setError]);
  
  // Add to the useEffect that handles button click events
  useEffect(() => {
    const viewButton = document.getElementById('viewButton');
    const cutButton = document.getElementById('cutButton');
    const moveButton = document.getElementById('moveButton');
    const downloadButton = document.getElementById('downloadButton');
  
    if (viewButton) viewButton.addEventListener('click', () => toggleEditorMode(EditorMode.View));
    if (cutButton) cutButton.addEventListener('click', () => toggleEditorMode(EditorMode.Cut));
    if (moveButton) moveButton.addEventListener('click', () => toggleEditorMode(EditorMode.Move));
    if (downloadButton) downloadButton.addEventListener('click', exportSelectedPart);
  
    return () => {
      if (viewButton) viewButton.removeEventListener('click', () => toggleEditorMode(EditorMode.View));
      if (cutButton) cutButton.removeEventListener('click', () => toggleEditorMode(EditorMode.Cut));
      if (moveButton) moveButton.removeEventListener('click', () => toggleEditorMode(EditorMode.Move));
      if (downloadButton) downloadButton.removeEventListener('click', exportSelectedPart);
    };
  }, [toggleEditorMode, exportSelectedPart]);
  
  // Include the exportSelectedPart in the return
  return {
    performCut,
    objectPartsRef,
    setupDragControls,
    toggleEditorMode,
    handleModelClick,
    exportSelectedPart,
  };
}