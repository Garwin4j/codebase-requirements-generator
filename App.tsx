import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomeScreen from './components/HomeScreen';
import ProcessingView from './components/ProcessingView';
import RequirementsDocument from './components/RequirementsDocument';
import { Project, FileAnalysis, ProjectUpdate, FileInfo } from './types';
import { generateRequirementsDocument } from './services/geminiService';
import { 
    createProject, 
    updateProject, 
    getProjects,
    deleteProject, 
    addFileAnalysisToProject 
} from './services/firebaseService';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [currentFile, setCurrentFile] = useState<string>(''); // For UI only
  const [isLoading, setIsLoading] = useState(true); // For initial project load
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnzipping, setIsUnzipping] = useState(false);
  const [unzippingFileName, setUnzippingFileName] = useState('');

  const workerRef = useRef<Worker | null>(null);
  
  const loadProjects = useCallback(async () => {
      setIsLoading(true);
      try {
          const fetchedProjects = await getProjects();
          setProjects(fetchedProjects);
      } catch (error) {
          console.error("Error fetching projects:", error);
          setErrorMessage("Could not load project history.");
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const startAnalysis = useCallback((project: Project) => {
    if (workerRef.current) {
        workerRef.current.terminate();
    }
    const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    // Re-attach listeners for the new worker instance
    attachWorkerListeners(worker, project.id);

    const processedPaths = new Set(project.fileAnalyses.map(a => a.path));
    const filesToAnalyze = project.filesToProcess.filter(f => !processedPaths.has(f.path));

    if (filesToAnalyze.length === 0 && project.totalFiles > 0) {
        if (project.status !== 'completed' && project.status !== 'generating') {
            updateProject(project.id, { status: 'generating' });
            setActiveProject(p => p && p.id === project.id ? { ...p, status: 'generating' } : p);
        }
        return;
    }

    if (project.status === 'paused' || project.status === 'error') {
        updateProject(project.id, { status: 'analyzing' });
        setActiveProject(p => p && p.id === project.id ? { ...p, status: 'analyzing' } : p);
    }

    worker.postMessage({ type: 'init', payload: { apiKey: process.env.API_KEY } });
    worker.postMessage({ type: 'start_analysis', payload: { filesToProcess: filesToAnalyze } });
  }, []);

  const attachWorkerListeners = useCallback((worker: Worker, projectId: string | null) => {
    worker.onmessage = async (event: MessageEvent) => {
        const { type, payload } = event.data;

        if (type === 'unzip_complete') {
            try {
                const newProjectId = await createProject(unzippingFileName, payload.allTextFiles);
                const newProject: Project = {
                    id: newProjectId,
                    projectName: unzippingFileName,
                    createdAt: new Date() as any, 
                    status: 'analyzing',
                    fileAnalyses: [],
                    filesToProcess: payload.allTextFiles,
                    requirementsDocument: '',
                    error: null,
                    totalFiles: payload.allTextFiles.length,
                    lastProcessedFile: null
                };
                setProjects(prev => [newProject, ...prev]);
                setActiveProject(newProject);
                setIsUnzipping(false);
                setUnzippingFileName('');
                startAnalysis(newProject);
            } catch (error) {
                console.error('Error creating project:', error);
                setErrorMessage('Failed to save project after unzipping.');
                setIsUnzipping(false);
                setUnzippingFileName('');
            }
            return;
        }

        // All subsequent messages require an active project that matches the worker's context
        if (!activeProject || (projectId && activeProject.id !== projectId)) return;

        switch(type) {
            case 'progress':
                setCurrentFile(payload.currentFile);
                break;
            case 'analysis_complete':
                await addFileAnalysisToProject(activeProject.id, payload.analysis);
                setActiveProject(p => p ? {
                    ...p,
                    fileAnalyses: [...p.fileAnalyses, payload.analysis],
                    lastProcessedFile: payload.analysis.path,
                } : null);
                break;
            case 'all_analyses_complete':
                await updateProject(activeProject.id, { status: 'generating' });
                setActiveProject(p => p ? { ...p, status: 'generating' } : null);
                break;
            case 'error':
                console.error('Error from worker:', payload.error, `File: ${payload.path}`);
                const msg = payload.path ? `Failed to analyze file: ${payload.path}.` : payload.error;
                setErrorMessage(msg);
                await updateProject(activeProject.id, { status: 'error', error: msg });
                setActiveProject(p => p ? { ...p, status: 'error', error: msg } : null);
                workerRef.current?.terminate();
                workerRef.current = null;
                break;
        }
    };

    worker.onerror = async (error) => {
        if (!activeProject || (projectId && activeProject.id !== projectId)) return;
        console.error('Unhandled worker error:', error);
        const msg = 'A critical error occurred during file processing.';
        setErrorMessage(msg);
        await updateProject(activeProject.id, { status: 'error', error: msg });
        setActiveProject(p => p ? { ...p, status: 'error', error: msg } : null);
        workerRef.current?.terminate();
        workerRef.current = null;
    };
  }, [activeProject, unzippingFileName, startAnalysis]);

  useEffect(() => {
    const generateDocument = async () => {
      if (activeProject?.status === 'generating' && activeProject.fileAnalyses.length > 0) {
        try {
          const document = await generateRequirementsDocument(activeProject.fileAnalyses);
          await updateProject(activeProject.id, { status: 'completed', requirementsDocument: document });
          setActiveProject(p => p ? { ...p, status: 'completed', requirementsDocument: document } : null);
        } catch (error) {
          console.error('Error generating requirements document:', error);
          const msg = 'Failed to generate the final document.';
          setErrorMessage(msg);
          await updateProject(activeProject.id, { status: 'error', error: msg });
          setActiveProject(p => p ? { ...p, status: 'error', error: msg } : null);
        }
      }
    };
    generateDocument();
  }, [activeProject?.status, activeProject?.id, activeProject?.fileAnalyses]);


  const handleStartNewProject = (file: File) => {
    try {
        if (workerRef.current) {
            workerRef.current.terminate();
        }
        const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        
        attachWorkerListeners(worker, null);

        setIsUnzipping(true);
        setUnzippingFileName(file.name);
        setActiveProject(null); // Clear active project to show unzipping view

        worker.postMessage({ type: 'init', payload: { apiKey: process.env.API_KEY } });
        worker.postMessage({ type: 'unzip_and_prepare', payload: { file } });
    } catch (error) {
      console.error('Error starting new project:', error);
      setErrorMessage('Failed to start new project. Please try again.');
    }
  };

  const handleResumeProject = (project: Project) => {
    setActiveProject(project);
    startAnalysis(project);
  };
  
  const handleViewProject = (project: Project) => {
    setActiveProject(project);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    
    try {
        await deleteProject(projectId);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProject?.id === projectId) {
            setActiveProject(null);
        }
    } catch (error) {
        console.error("Error deleting project:", error);
        setErrorMessage("Failed to delete the project.");
    }
  };
  
  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
        await updateProject(projectId, { projectName: newName });
        setProjects(prevProjects => 
            prevProjects.map(p => 
                p.id === projectId ? { ...p, projectName: newName } : p
            )
        );
        if (activeProject?.id === projectId) {
            setActiveProject(p => p ? { ...p, projectName: newName } : null);
        }
    } catch (error) {
        console.error("Error renaming project:", error);
        setErrorMessage("Failed to rename the project.");
    }
  };

  const handleReset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setActiveProject(null);
    setCurrentFile('');
    setErrorMessage(null);
    loadProjects();
  }, [loadProjects]);

  const handlePause = useCallback(async () => {
    if (workerRef.current && activeProject && activeProject.status === 'analyzing') {
      workerRef.current.postMessage({ type: 'pause' });
      await updateProject(activeProject.id, { status: 'paused' });
      setActiveProject(p => p ? {...p, status: 'paused'} : null);
    }
  }, [activeProject]);

  const handleResumeAnalysis = useCallback(async () => {
    if (activeProject && activeProject.status === 'paused') {
      // The startAnalysis function handles resuming
      startAnalysis(activeProject);
    }
  }, [activeProject, startAnalysis]);

  const renderContent = () => {
      if (isUnzipping) {
          return (
              <div className="p-8 flex flex-col items-center justify-center min-h-[20rem]">
                  <h2 className="text-2xl font-bold text-gray-200 mb-4">Decompressing {unzippingFileName}...</h2>
                  <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
              </div>
          );
      }
      if (activeProject) {
        switch (activeProject.status) {
            case 'completed':
                return <RequirementsDocument document={activeProject.requirementsDocument} onReset={handleReset} />;
            case 'error':
                 return (
                    <div className="text-center p-8 bg-gray-800 rounded-lg">
                      <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
                      <p className="text-gray-300 mb-6">{activeProject.error || "An unknown error occurred."}</p>
                      <button onClick={handleReset} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold transition-colors">
                        Back to Home
                      </button>
                    </div>
                  );
            default:
                return (
                    <ProcessingView
                        project={activeProject}
                        currentFile={currentFile}
                        onPause={handlePause}
                        onResume={handleResumeAnalysis}
                    />
                );
        }
      }
      
      return (
          <HomeScreen 
              projects={projects}
              isLoading={isLoading}
              onStartNewProject={handleStartNewProject}
              onResumeProject={handleResumeProject}
              onViewProject={handleViewProject}
              onDeleteProject={handleDeleteProject}
              onRenameProject={handleRenameProject}
          />
      );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Codebase Requirements Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Analyze your codebase or resume a previous session.
          </p>
        </header>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl shadow-indigo-900/20 border border-gray-700">
          {errorMessage && (
            <div className="p-4 bg-red-900/50 border-b border-red-700 text-center text-red-300">
                {errorMessage}
                <button onClick={() => setErrorMessage(null)} className="ml-4 font-bold">X</button>
            </div>
          )}
          {renderContent()}
        </div>
        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Google Gemini</p>
        </footer>
      </main>
    </div>
  );
}
