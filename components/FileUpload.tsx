
import React, { useState, useCallback } from 'react';
import { UploadCloudIcon } from './icons/UploadCloudIcon';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true); // Keep it active while dragging over
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="p-8">
      <label
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging
            ? 'border-indigo-500 bg-gray-700'
            : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloudIcon className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-indigo-400' : 'text-gray-400'}`} />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">ZIP file containing your codebase</p>
        </div>
        <input
          id="dropzone-file"
          type="file"
          className="hidden"
          accept=".zip"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
};

export default FileUpload;
