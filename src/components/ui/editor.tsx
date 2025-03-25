import React, { useState, useRef, useEffect } from "react";
import { useThreeJsSetup } from "./editor/useThreeJsSetup";
import { useModelLoading } from "./editor/useModelLoading";
import { useMouseHandlers, EditorMode } from "./editor/useMouseHandlers";
import { useCuttingLogic } from "./editor/useCuttingLogic";

interface EditorProps {
  initialFile?: File;
}

const Editor: React.FC<EditorProps> = ({ initialFile }) => {
  // Create the ref correctly
  const canvasRef = useRef<HTMLDivElement>(null!);

  // State
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.View);
  const [error, setError] = useState<string | null>(null);

  // Initialize Three.js scene
  const { sceneRef, cameraRef, rendererRef, controlsRef, isInitialized } = useThreeJsSetup(canvasRef);

  // Load model
  const { modelRef, modelLoaded, loadingProgress, error: modelError } = useModelLoading({
    sceneRef,
    initialFile
  });

  // Set error from model loading
  useEffect(() => {
    if (modelError) {
      setError(modelError);
    }
  }, [modelError]);

  // Cutting logic
  const { performCut, toggleEditorMode, objectPartsRef, exportSelectedPart } = useCuttingLogic({
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    modelRef,
    setError,
    setEditorMode
  });

  // Add this state to track if any parts have been cut
  const [hasCutParts, setHasCutParts] = useState(false);

  // Update hasCutParts when objectPartsRef changes
  useEffect(() => {
    setHasCutParts(objectPartsRef.current.length > 0);
  }, [objectPartsRef.current]);

  // Ensure controls are enabled/disabled based on editor mode
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = editorMode === EditorMode.View;
    }
  }, [editorMode, controlsRef]);

  return (
    <section className="h-full w-full col-span-8 row-span-8 grid grid-cols-6 grid-rows-6 relative">
      {/* File info overlay */}
      <div className="absolute top-0 left-0 bg-black bg-opacity-50 p-2 z-10 text-white text-xs">
        {initialFile ? `File: ${initialFile.name}` : "No file provided"}
        {modelLoaded ? " - Model loaded" : " - Model not loaded"}
      </div>

      {/* Tools panel */}
      <div className="absolute top-12 left-4 bg-gray-800 bg-opacity-75 p-2 rounded-md z-10">
        <div className="flex flex-col space-y-2">
          <button
            id="viewButton"
            className={`px-4 py-2 rounded ${editorMode === EditorMode.View ? "bg-blue-500" : "bg-gray-600"}`}
            onClick={() => toggleEditorMode(EditorMode.View)}
          >
            View
          </button>
          <button
            id="cutButton"
            className={`px-4 py-2 rounded ${editorMode === EditorMode.Cut ? "bg-blue-500" : "bg-gray-600"}`}
            onClick={() => toggleEditorMode(EditorMode.Cut)}
            disabled={!modelLoaded}
          >
            Cut
          </button>
          <button
            id="moveButton"
            className={`px-4 py-2 rounded ${editorMode === EditorMode.Move ? "bg-blue-500" : "bg-gray-600"}`}
            onClick={() => toggleEditorMode(EditorMode.Move)}
            disabled={objectPartsRef.current.length === 0}
          >
            Move
          </button>
          <button 
            id="downloadButton"
            className={`px-4 py-2 rounded mt-4 ${
              hasCutParts && editorMode === EditorMode.Move ? "bg-green-600" : "bg-gray-600"
            }`}
            onClick={exportSelectedPart}
            disabled={!hasCutParts || editorMode !== EditorMode.Move}
            title="Select a part first to download it"
          >
            Download Selected Part
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full col-span-6 row-span-6"
      ></div>
      {/* Loading progress indicator */}
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
          {editorMode === EditorMode.View && (
            <p className="text-gray-400">Use mouse to orbit, zoom and pan</p>
          )}
          {editorMode === EditorMode.Cut && (
            <p className="text-gray-400">
              Click and drag to define a cutting plane
            </p>
          )}
          {editorMode === EditorMode.Move && (
            <p className="text-gray-400">
              Click and drag to move the parts independently
            </p>
          )}
        </div>
      )}

      {/* Mode indicator */}
      {editorMode !== EditorMode.View && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-700 text-white py-1 px-3 rounded-md z-20 text-sm">
          Camera rotation disabled
        </div>
      )}
    </section>
  );
};

export default Editor;