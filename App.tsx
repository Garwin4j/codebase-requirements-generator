import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomeScreen from './components/HomeScreen';
import ProcessingView from './components/ProcessingView';
import RequirementsDocument from './components/RequirementsDocument';
// FIX: Import `ProjectUpdate` to correctly type the project update object.
import { Project, FileAnalysis, ProjectUpdate } from './types';
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

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resumingProjectIdRef = useRef<string | null>(null);
  
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

  useEffect(() => {
      if (!workerRef.current) return;

      workerRef.current.onmessage = async (event: MessageEvent) => {
          if (!activeProject) return;

          const { type, payload } = event.data;
          switch(type) {
              case 'unzip_complete':
                  // FIX: Explicitly type `projectUpdate` to ensure `status` conforms to `ProjectStatus`.
                  const projectUpdate: ProjectUpdate = { 
                      status: 'analyzing', 
                      totalFiles: payload.totalFiles,
                      filesToProcess: payload.filePaths,
                  };
                  await updateProject(activeProject.id, projectUpdate);
                  setActiveProject(p => p ? { ...p, ...projectUpdate } : null);
                  break;
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

      workerRef.current.onerror = async (error) => {
          if (!activeProject) return;
          console.error('Unhandled worker error:', error);
          const msg = 'A critical error occurred during file processing.';
          setErrorMessage(msg);
          await updateProject(activeProject.id, { status: 'error', error: msg });
          setActiveProject(p => p ? { ...p, status: 'error', error: msg } : null);
          workerRef.current?.terminate();
          workerRef.current = null;
      };
  }, [activeProject]);

  const startAnalysis = useCallback((project: Project, file: File) => {
      if (workerRef.current) {
          workerRef.current.terminate();
      }
      const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      
      const processedPaths = project.fileAnalyses.map(a => a.path);

      worker.postMessage({ type: 'init', payload: { apiKey: process.env.API_KEY } });
      worker.postMessage({ type: 'start', payload: { file, processedPaths } });
  }, []);
  
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
  }, [activeProject]);

  const handleStartNewProject = async (file: File) => {
    try {
      const newProjectId = await createProject(file.name);
      // Create a local representation immediately to update the UI
      // The timestamp will be a client-side estimate until the next fetch
      const newProject: Project = {
          id: newProjectId,
          projectName: file.name,
          createdAt: new Date() as any, 
          status: 'unzipping',
          fileAnalyses: [],
          filesToProcess: [],
          requirementsDocument: '',
          error: null,
          totalFiles: 0,
          lastProcessedFile: null
      };
      setProjects(prev => [newProject, ...prev]);
      setActiveProject(newProject);
      startAnalysis(newProject, file);
    } catch (error) {
      console.error('Error creating project:', error);
      setErrorMessage('Failed to start new project. Please check your connection.');
    }
  };

  const handleResumeProject = (project: Project) => {
    resumingProjectIdRef.current = project.id;
    fileInputRef.current?.click();
  };

  const handleResumingFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const projectId = resumingProjectIdRef.current;
    if (!file || !projectId) return;

    const projectToResume = projects.find(p => p.id === projectId);
    if (!projectToResume) return;

    if (file.name !== projectToResume.projectName) {
        alert("The selected file does not match the original project file. Please select the correct ZIP file.");
        return;
    }

    setActiveProject(projectToResume);
    startAnalysis(projectToResume, file);
    
    resumingProjectIdRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (workerRef.current && activeProject) {
      workerRef.current.postMessage({ type: 'pause' });
      await updateProject(activeProject.id, { status: 'paused' });
      setActiveProject(p => p ? {...p, status: 'paused'} : null);
    }
  }, [activeProject]);

  const handleResumeAnalysis = useCallback(async () => {
    if (workerRef.current && activeProject) {
      workerRef.current.postMessage({ type: 'resume' });
      await updateProject(activeProject.id, { status: 'analyzing' });
      setActiveProject(p => p ? {...p, status: 'analyzing'} : null);
    }
  }, [activeProject]);

  const renderContent = () => {
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
      <input 
          type="file" 
          accept=".zip"
          ref={fileInputRef} 
          onChange={handleResumingFileSelected}
          style={{ display: 'none' }} 
      />
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