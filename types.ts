import { FieldValue, Timestamp } from 'firebase/firestore';

export enum AppState {
  IDLE = 'IDLE',
  UNZIPPING = 'UNZIPPING',
  ANALYZING = 'ANALYZING',
  PAUSED = 'PAUSED',
  GENERATING = 'GENERATING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export interface FileInfo {
  path: string;
  content: string;
}

export interface FileAnalysis {
  path: string;
  analysis: string;
}

export type ProjectStatus = 'unzipping' | 'analyzing' | 'generating' | 'completed' | 'error' | 'paused';


// Represents a project object used within the React application state.
export interface Project {
  id: string;
  projectName: string;
  createdAt: Timestamp; // Firestore timestamp object after fetching
  status: ProjectStatus;
  totalFiles: number;
  filesToProcess: string[];
  fileAnalyses: FileAnalysis[];
  requirementsDocument: string;
  error: string | null;
  lastProcessedFile: string | null;
}

// Represents the data structure stored in Firestore.
export interface ProjectData {
  projectName: string;
  createdAt: FieldValue; // serverTimestamp() on creation
  status: ProjectStatus;
  totalFiles: number;
  filesToProcess: string[];
  fileAnalyses: FileAnalysis[];
  requirementsDocument: string;
  error: string | null;
  lastProcessedFile: string | null;
}

export type ProjectUpdate = Partial<Omit<ProjectData, 'createdAt' | 'fileAnalyses'>>;