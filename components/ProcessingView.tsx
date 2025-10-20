import React from 'react';
import { AppState } from '../types';
import { FileCodeIcon } from './icons/FileCodeIcon';
import { PauseIcon } from './icons/PauseIcon';
import { PlayIcon } from './icons/PlayIcon';

interface ProcessingViewProps {
  state: AppState;
  progress: number;
  totalFiles: number;
  currentFile: string;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ state, progress, totalFiles, currentFile, isPaused, onPause, onResume }) => {
  const getStatusText = () => {
    switch (state) {
      case AppState.UNZIPPING:
        return 'Decompressing archive...';
      case AppState.ANALYZING:
        return 'Analyzing codebase...';
      case AppState.PAUSED:
        return 'Analysis Paused';
      case AppState.GENERATING:
        return 'Synthesizing requirements document...';
      default:
        return 'Processing...';
    }
  };
  
  const formattedProgress = progress.toFixed(0);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[20rem]">
      <h2 className="text-2xl font-bold text-gray-200 mb-4">{getStatusText()}</h2>
      
      {(state === AppState.ANALYZING || state === AppState.PAUSED) && (
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-base font-medium text-indigo-400">Analysis Progress</span>
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
      
      {(state === AppState.ANALYZING || state === AppState.PAUSED) && currentFile && (
        <div className="flex items-center text-gray-400 mt-4 bg-gray-900/50 px-4 py-2 rounded-lg">
          <FileCodeIcon className="w-5 h-5 mr-3 text-gray-500" />
          <span className="font-mono text-sm truncate">{currentFile}</span>
        </div>
      )}

      {(state === AppState.UNZIPPING || state === AppState.GENERATING) && (
         <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
      )}
      
      {(state === AppState.ANALYZING || state === AppState.PAUSED) && (
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