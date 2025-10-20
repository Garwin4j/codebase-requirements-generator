import { FieldValue } from 'firebase/firestore';

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

export type ProjectStatus = 'unzipping' | 'analyzing' | 'generating' | 'completed' | 'error';

export interface ProjectData {
  projectName: string;
  createdAt: FieldValue;
  status: ProjectStatus;
  fileAnalyses: FileAnalysis[];
  requirementsDocument: string;
  error: string | null;
}

export type ProjectUpdate = Partial<ProjectData>;

export interface Project extends ProjectData {
  id: string;
}