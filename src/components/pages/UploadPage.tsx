import React from "react";
import { useNavigate } from "react-router-dom";
import ImportComponent from "../ui/ImportComponent";

const UploadPage: React.FC = () => {
  const navigate = useNavigate();

  const handleFileUploadSuccess = (file: File) => {
    console.log(
      "Upload success: File type:",
      file.type,
      "Size:",
      file.size,
      "Name:",
      file.name,
    );
    navigate("/editor", {
      state: { file },
    });
  };

  return (
    <div className="col-start-4 col-span-6 row-start-6 row-span-4 grid place-items-center">
      <ImportComponent
        title="Import 3D Model"
        showDetails={true}
        onUploadSuccess={handleFileUploadSuccess}
      />
    </div>
  );
};

export default UploadPage;
