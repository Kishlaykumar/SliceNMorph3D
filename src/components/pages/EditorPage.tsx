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
    
    if (!uploadedFile) {
      console.log("No file provided, redirecting to upload page");
      navigate('/upload');
    }
  }, [uploadedFile, navigate, location]);

  return (
    <div className="w-full h-full col-start-2 col-span-11 row-span-12 grid grid-cols-6 grid-rows-6">
      <Editor initialFile={uploadedFile} />
    </div>
  );
};

export default EditorPage;