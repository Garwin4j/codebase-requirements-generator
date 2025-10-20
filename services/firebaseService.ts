// Fix: Use a namespace import for firebase/app to work around a module resolution issue.
import * as firebaseApp from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ProjectData, ProjectUpdate } from '../types';

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
const app = firebaseApp.initializeApp(firebaseConfig);
const db = getFirestore(app);

const projectsCollection = collection(db, 'projects');

export const createProject = async (projectName: string): Promise<string> => {
  const newProject: ProjectData = {
    projectName,
    createdAt: serverTimestamp(),
    status: 'unzipping',
    fileAnalyses: [],
    requirementsDocument: '',
    error: null,
  };
  const docRef = await addDoc(projectsCollection, newProject);
  return docRef.id;
};

export const updateProject = async (projectId: string, data: ProjectUpdate): Promise<void> => {
  const projectDoc = doc(db, 'projects', projectId);
  await updateDoc(projectDoc, { ...data });
};