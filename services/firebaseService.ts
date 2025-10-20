// FIX: The namespace import for firebase/app was incorrect. Changed to a named import for `initializeApp` to follow Firebase v9 modular SDK conventions and resolve the error.
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  getDoc,
  arrayUnion
} from 'firebase/firestore';
import { ProjectData, ProjectUpdate, Project, FileAnalysis } from '../types';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWeofTYqoFFKkDGAbr__NSIf2F_RIWyKY",
  authDomain: "codebase-requirments-generator.firebaseapp.com",
  projectId: "codebase-requirments-generator",
  storageBucket: "codebase-requirments-generator.firebasestorage.app",
  messagingSenderId: "455547013559",
  appId: "1:455547013559:web:072532264c139db5e00032",
  measurementId: "G-34V8GJJ4PM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const projectsCollection = collection(db, 'projects');

export const createProject = async (projectName: string): Promise<string> => {
  const newProjectData: Omit<ProjectData, 'createdAt'> & { createdAt: any } = {
    projectName,
    createdAt: serverTimestamp(),
    status: 'unzipping',
    fileAnalyses: [],
    requirementsDocument: '',
    error: null,
    totalFiles: 0,
    lastProcessedFile: null,
    filesToProcess: [],
  };
  const docRef = await addDoc(projectsCollection, newProjectData);
  return docRef.id;
};

export const updateProject = async (projectId: string, data: ProjectUpdate): Promise<void> => {
  const projectDoc = doc(db, 'projects', projectId);
  await updateDoc(projectDoc, data);
};

export const addFileAnalysisToProject = async (projectId:string, analysis: FileAnalysis): Promise<void> => {
    const projectDoc = doc(db, 'projects', projectId);
    await updateDoc(projectDoc, {
        fileAnalyses: arrayUnion(analysis),
        lastProcessedFile: analysis.path,
    });
};

export const getProjects = async (): Promise<Project[]> => {
    const q = query(projectsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Project));
};

export const getProject = async (projectId: string): Promise<Project | null> => {
    const projectDoc = doc(db, 'projects', projectId);
    const docSnap = await getDoc(projectDoc);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Project;
    } else {
        return null;
    }
};

export const deleteProject = async (projectId: string): Promise<void> => {
    const projectDoc = doc(db, 'projects', projectId);
    await deleteDoc(projectDoc);
};