import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import components
import MainLayout from './components/layout/MainLayout';
import UploadPage from './components/pages/UploadPage';
import EditorPage from './components/pages/EditorPage';

function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route 
          path="/upload" 
          element={
            <MainLayout>
              <UploadPage />
            </MainLayout>
          } 
        />
        <Route 
          path="/editor" 
          element={
            <MainLayout>
              <EditorPage />
            </MainLayout>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;