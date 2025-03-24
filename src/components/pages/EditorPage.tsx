import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Editor from '../ui/editor';

const EditorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const uploadedFile = location.state?.file;

  useEffect(() => {
    console.log("EditorPage: location state:", location.state);
    console.log("EditorPage: Received file:", uploadedFile);
    
    // If no file is provided, redirect back to upload page
    if (!uploadedFile) {
      console.log("No file provided, redirecting to upload page");
      navigate('/upload');
    }
  }, [uploadedFile, navigate, location]);

  return (
    <div className="w-full h-full" style={{ width: '100%', height: '100%' }}>
      <Editor initialFile={uploadedFile} />
    </div>
  );
};

export default EditorPage;