import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUpload from './components/FileUpload';
import ProcessingView from './components/ProcessingView';
import RequirementsDocument from './components/RequirementsDocument';
import { AppState, FileInfo, FileAnalysis } from './types';
import { unzipFile } from './services/zipService';
import { generateRequirementsDocument } from './services/geminiService';
import { createProject, updateProject } from './services/firebaseService';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [fileTree, setFileTree] = useState<FileInfo[]>([]);
  const [fileAnalyses, setFileAnalyses] = useState<FileAnalysis[]>([]);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [requirementsDocument, setRequirementsDocument] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const handleFileSelect = async (file: File) => {
    try {
      const newProjectId = await createProject(file.name);
      setProjectId(newProjectId);
      setZipFile(file);
      setAppState(AppState.UNZIPPING);
    } catch (error) {
      console.error('Error creating project in Firebase:', error);
      setErrorMessage('Failed to connect to the database. Please try again later.');
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setAppState(AppState.IDLE);
    setZipFile(null);
    setFileTree([]);
    setFileAnalyses([]);
    setCurrentFile('');
    setAnalysisProgress(0);
    setRequirementsDocument('');
    setErrorMessage(null);
    setProjectId(null);
    setIsPaused(false);
  }, []);
  
  const handlePause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'pause' });
      setIsPaused(true);
      setAppState(AppState.PAUSED);
    }
  }, []);

  const handleResume = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'resume' });
      setIsPaused(false);
      setAppState(AppState.ANALYZING);
    }
  }, []);

  useEffect(() => {
    const processFiles = async () => {
      if (appState === AppState.UNZIPPING && zipFile && projectId) {
        try {
          const files = await unzipFile(zipFile);
          const relevantFiles = files.filter(file => 
            !file.path.startsWith('__MACOSX/') && 
            !file.path.endsWith('.DS_Store') &&
            !file.path.endsWith('/')
          );
          setFileTree(relevantFiles);
          await updateProject(projectId, { status: 'analyzing' });
          setAppState(AppState.ANALYZING);
        } catch (error) {
          console.error('Error unzipping file:', error);
          const msg = 'Failed to unzip the file. Please ensure it is a valid .zip archive.';
          setErrorMessage(msg);
          if (projectId) await updateProject(projectId, { status: 'error', error: msg });
          setAppState(AppState.ERROR);
        }
      }
    };
    processFiles();
  }, [appState, zipFile, projectId]);

  useEffect(() => {
    if (appState === AppState.ANALYZING && fileTree.length > 0 && projectId && !isPaused && !workerRef.current) {
        const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            switch(type) {
                case 'progress':
                    setAnalysisProgress(payload.progress);
                    setCurrentFile(payload.currentFile);
                    setFileAnalyses(prev => [...prev, payload.analysis]);
                    break;
                case 'done':
                    updateProject(projectId, { status: 'generating', fileAnalyses: payload.analyses });
                    setAppState(AppState.GENERATING);
                    worker.terminate();
                    workerRef.current = null;
                    break;
                case 'error':
                    console.error('Error from worker:', payload.error, `File: ${payload.path}`);
                    const msg = `Failed to analyze file: ${payload.path}. Processing has stopped.`;
                    setErrorMessage(msg);
                    if (projectId) updateProject(projectId, { status: 'error', error: msg });
                    setAppState(AppState.ERROR);
                    worker.terminate();
                    workerRef.current = null;
                    break;
            }
        };

        worker.onerror = (error) => {
            console.error('Unhandled worker error:', error);
            const msg = 'A critical error occurred during file analysis.';
            setErrorMessage(msg);
            setAppState(AppState.ERROR);
            if (projectId) updateProject(projectId, { status: 'error', error: msg });
            worker.terminate();
            workerRef.current = null;
        };
        
        worker.postMessage({ type: 'init', payload: { apiKey: process.env.API_KEY } });
        worker.postMessage({ type: 'start', payload: { files: fileTree } });
    }

    return () => {
      // This cleanup function will be called if the component unmounts or dependencies change.
      // We terminate the worker on reset, so we don't need to do it here for every re-render.
    };
}, [appState, fileTree, projectId, isPaused]);
  
  useEffect(() => {
    const generateDocument = async () => {
      if (appState === AppState.GENERATING && fileAnalyses.length > 0 && projectId) {
        try {
          const document = await generateRequirementsDocument(fileAnalyses);
          setRequirementsDocument(document);
          await updateProject(projectId, { status: 'completed', requirementsDocument: document });
          setAppState(AppState.DONE);
        } catch (error) {
          console.error('Error generating requirements document:', error);
          const msg = 'Failed to generate the final document. An issue occurred with the AI model.';
          setErrorMessage(msg);
          if (projectId) await updateProject(projectId, { status: 'error', error: msg });
          setAppState(AppState.ERROR);
        }
      }
    };
    generateDocument();
  }, [appState, fileAnalyses, projectId]);

  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
        return <FileUpload onFileSelect={handleFileSelect} />;
      case AppState.UNZIPPING:
      case AppState.ANALYZING:
      case AppState.PAUSED:
      case AppState.GENERATING:
        return (
          <ProcessingView
            state={appState}
            progress={analysisProgress}
            totalFiles={fileTree.length}
            currentFile={currentFile}
            isPaused={isPaused}
            onPause={handlePause}
            onResume={handleResume}
          />
        );
      case AppState.DONE:
        return (
          <RequirementsDocument document={requirementsDocument} onReset={handleReset} />
        );
      case AppState.ERROR:
        return (
          <div className="text-center p-8 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
            <p className="text-gray-300 mb-6">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Codebase Requirements Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Upload a .NET & React codebase to generate a detailed requirements document.
          </p>
        </header>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl shadow-indigo-900/20 border border-gray-700">
          {renderContent()}
        </div>
        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Google Gemini</p>
        </footer>
      </main>
    </div>
  );
}