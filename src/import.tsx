import React, { useState, useRef, useCallback } from "react";
import { ReactComponent as UploadIcon } from './assets/uploadIcon.svg';

interface ImportComponentProps {
  title: string;
  showDetails?: boolean;
  onFileImport?: (file: File) => void;
}

const ImportComponent: React.FC<ImportComponentProps> = ({
  title,
  showDetails = false,
  onFileImport,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.gltf', '.glb'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      setAlertMessage({
        text: 'Invalid file format! Please upload a GLTF or GLB file.',
        type: 'error'
      });
      return false;
    }
    
    return true;
  };

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setAlertMessage({
        text: `Successfully imported ${file.name}`,
        type: 'success'
      });
      
      if (onFileImport) {
        onFileImport(file);
      }
    }
  }, [onFileImport]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Close alert after 3 seconds
  React.useEffect(() => {
    if (alertMessage.type) {
      const timer = setTimeout(() => {
        setAlertMessage({ text: '', type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  return (
    <section className="text-white p-4 w-full h-full grid place-items-center">
      <div 
        className={`bg-gray-900 w-full h-full rounded-lg p-4 grid place-items-center border-2 border-dashed ${
          isDragging ? 'border-blue-500 bg-gray-800' : 'border-gray-700'
        } transition-colors duration-200`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <p>{isDragging ? 'Drop to import' : 'Drag glTF or GLB file here'}</p>
        {showDetails && (
          <p className="text-sm text-gray-400 mt-2">
            Supported formats: .gltf, .glb
          </p>
        )}
      </div>
      
      <div 
        className="flex justify-center items-center mt-4 cursor-pointer hover:bg-gray-800 p-2 rounded transition-colors"
        onClick={handleBrowseClick}
      >
        <UploadIcon className="w-6 h-6 mx-2" />
        <p>Choose file</p>
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden"
          accept=".gltf,.glb"
          onChange={handleFileInputChange}
        />
      </div>
      
      {alertMessage.type && (
        <div className={`mt-4 p-3 rounded-md ${
          alertMessage.type === 'success' ? 'bg-green-800' : 'bg-red-800'
        }`}>
          {alertMessage.text}
        </div>
      )}
    </section>
  );
};

export default ImportComponent;