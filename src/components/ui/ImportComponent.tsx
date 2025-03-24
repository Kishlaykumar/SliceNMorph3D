import React, { useState, useRef } from "react";
import { ReactComponent as UploadIcon } from '../../assets/uploadIcon.svg';

interface ImportComponentProps {
  title: string;
  showDetails?: boolean;
  onFileImport?: (file: File) => void;
  onUploadSuccess?: (file: File) => void; // Updated to accept a File parameter
}

const ImportComponent: React.FC<ImportComponentProps> = ({
  title,
  showDetails = false,
  onFileImport,
  onUploadSuccess,
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

  // In your handleFileImport function
const handleFileImport = (file: File) => {
  if (validateFile(file)) {
    if (onFileImport) {
      onFileImport(file);
    }
    
    setAlertMessage({
      text: 'File imported successfully!',
      type: 'success'
    });
    
    // Make sure to pass the file to the callback
    if (onUploadSuccess) {
      console.log("Calling onUploadSuccess with file:", file.name);
      onUploadSuccess(file);
    }
  }
};

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
      handleFileImport(files[0]); // Fixed: calling handleFileImport instead of handleFile
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileImport(files[0]); // Fixed: calling handleFileImport instead of handleFile
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Close alert after 3 seconds
  React.useEffect(() => {
    if (alertMessage.type) {
      console.log("Alert showing:", alertMessage);
      const timer = setTimeout(() => {
        setAlertMessage({ text: '', type: null });
      }, 5000);
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
        <div className={`fixed top-4 right-4 z-50 mt-4 p-4 rounded-md shadow-lg ${
          alertMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {alertMessage.text}
        </div>
      )}
    </section>
  );
};

export default ImportComponent;