import { useCallback, useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

interface UseModelLoadingProps {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  initialFile?: File;
}

export function useModelLoading({
  sceneRef,
  initialFile,
}: UseModelLoadingProps) {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Load model function
  const loadModel = useCallback(
    (file: File) => {
      if (!sceneRef.current) {
        setError("Scene not initialized");
        return;
      }

      setError(null);
      setLoadingProgress(0);

      // Remove previous model if exists
      if (modelRef.current) {
        // First traverse and clear any userData flags
        modelRef.current.traverse((object) => {
          if (object.userData) {
            object.userData.isOriginalModel = false;
          }
        });

        // Then remove from scene
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

          // Mark the entire model and all its children as original
          model.userData.isOriginalModel = true;
          model.traverse((object) => {
            object.userData.isOriginalModel = true;
          });

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
          if (sceneRef.current) {
            sceneRef.current.add(model);
            modelRef.current = model;
            setModelLoaded(true);
            setLoadingProgress(100);
          } else {
            setError("Failed to add model to scene");
          }

          // Clean up object URL
          URL.revokeObjectURL(objectUrl);
        },
        (progress) => {
          // Progress callback
          if (progress.lengthComputable) {
            const progressPercent = Math.round(
              (progress.loaded / progress.total) * 100,
            );
            setLoadingProgress(progressPercent);
          }
        },
        (error) => {
          // Error callback
          console.error("Error loading model:", error);
          setError("Failed to load the 3D model. Please try a different file.");
          URL.revokeObjectURL(objectUrl);
        },
      );
    },
    [sceneRef],
  );

  // Load model when initialFile changes
  useEffect(() => {
    if (initialFile && sceneRef.current) {
      loadModel(initialFile);
    }
  }, [initialFile, sceneRef, loadModel]);

  return {
    modelRef,
    modelLoaded,
    loadingProgress,
    error,
    loadModel,
  };
}
