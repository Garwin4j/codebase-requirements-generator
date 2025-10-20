
import React from 'react';
import { Project } from '../types';
import { FileCodeIcon } from './icons/FileCodeIcon';
import { PauseIcon } from './icons/PauseIcon';
import { PlayIcon } from './icons/PlayIcon';

interface ProcessingViewProps {
  project: Project;
  currentFile: string;
  onPause: () => void;
  onResume: () => void;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ project, currentFile, onPause, onResume }) => {
  const getStatusText = () => {
    switch (project.status) {
      case 'unzipping':
        return 'Decompressing archive...';
      case 'analyzing':
        return 'Analyzing codebase...';
      case 'paused':
        return 'Analysis Paused';
      case 'generating':
        return 'Synthesizing requirements document...';
      default:
        return 'Processing...';
    }
  };
  
  const isPaused = project.status === 'paused';
  const isAnalyzing = project.status === 'analyzing' || project.status === 'paused';
  const progress = project.totalFiles > 0 ? (project.fileAnalyses.length / project.totalFiles) * 100 : 0;
  const formattedProgress = progress.toFixed(0);
  const fileToShow = currentFile || project.lastProcessedFile;

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[20rem]">
      <h2 className="text-2xl font-bold text-gray-200 mb-4">{getStatusText()}</h2>
      
      {isAnalyzing && (
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-base font-medium text-indigo-400">Analysis Progress ({project.fileAnalyses.length} / {project.totalFiles})</span>
            <span className="text-sm font-medium text-indigo-400">{formattedProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${formattedProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {isAnalyzing && fileToShow && (
        <div className="flex items-center text-gray-400 mt-4 bg-gray-900/50 px-4 py-2 rounded-lg max-w-full">
          <FileCodeIcon className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" />
          <span className="font-mono text-sm truncate">{fileToShow}</span>
        </div>
      )}

      {(project.status === 'unzipping' || project.status === 'generating') && (
         <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
      )}
      
      {isAnalyzing && (
        <div className="mt-6">
          {!isPaused ? (
            <button
              onClick={onPause}
              className="flex items-center px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md font-semibold transition-colors"
            >
              <PauseIcon className="w-4 h-4 mr-2" />
              Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors"
            >
              <PlayIcon className="w-4 h-4 mr-2" />
              Resume
            </button>
          )}
        </div>
      )}

    </div>
  );
};

export default ProcessingView;
