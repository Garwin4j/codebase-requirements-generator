import { GoogleGenAI } from "@google/genai";
import JSZip from 'jszip';
import { GEMINI_MODEL } from './constants';
import type { FileInfo, FileAnalysis } from './types';

let ai: GoogleGenAI | null = null;
let isPaused = false;
let currentProcessingQueue: FileInfo[] = [];
let fileIndex = 0;


const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function withRetry<T>(fn: () => Promise<T>, path: string): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error(`Operation for ${path} failed after ${MAX_RETRIES} retries:`, error);
        throw error;
      }
      console.warn(`Attempt ${retries} for ${path} failed. Retrying...`, error);
      const delayTime = INITIAL_DELAY_MS * Math.pow(2, retries - 1) + Math.random() * 1000;
      await delay(delayTime);
    }
  }
}

const analyzeFileContentInWorker = async (path: string, content: string): Promise<string> => {
  if (!ai) throw new Error("AI not initialized");

  return withRetry(async () => {
    const prompt = `
      Analyze the following code from the file at path "${path}".
      Your task is to explain its primary purpose, key functionalities, and its role within a larger .NET and React application.
      Focus on what the code *does*. Be concise and clear.

      Do not include introductory phrases like "This file contains..." or "The purpose of this file is...".
      Just provide the analysis directly.

      Code:
      \`\`\`
      ${content}
      \`\`\`
    `;
    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
    });
    return response.text;
  }, path);
};

const processNextFile = async () => {
  if (isPaused) {
    return;
  }
  
  if (fileIndex >= currentProcessingQueue.length) {
    self.postMessage({ type: 'all_analyses_complete' });
    return;
  }

  const file = currentProcessingQueue[fileIndex];
  try {
    self.postMessage({ type: 'progress', payload: { currentFile: file.path } });
    
    const analysisText = await analyzeFileContentInWorker(file.path, file.content);
    const analysis: FileAnalysis = { path: file.path, analysis: analysisText };
    
    self.postMessage({ type: 'analysis_complete', payload: { analysis } });

    fileIndex++;
    setTimeout(processNextFile, 0);
  } catch (error: any) {
    self.postMessage({ type: 'error', payload: { error: error.message, path: file.path } });
  }
};

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;
  switch (type) {
    case 'init':
      if (!payload.apiKey) {
        console.error("Worker received init without API key.");
        self.postMessage({ type: 'error', payload: { error: 'API Key is missing.' } });
        return;
      }
      ai = new GoogleGenAI({ apiKey: payload.apiKey });
      break;

    case 'unzip_and_prepare':
        try {
            const zip = await JSZip.loadAsync(payload.file);
            const filePromises: Promise<void>[] = [];
            const allFiles: FileInfo[] = [];
    
            Object.keys(zip.files).forEach((filename) => {
                const zipEntry = zip.files[filename];
                if (!zipEntry.dir) {
                    const promise = zipEntry.async('string').then(content => {
                        allFiles.push({ path: filename, content });
                    }).catch(e => {
                        console.warn(`Could not read file ${filename} as text, skipping.`);
                    });
                    filePromises.push(promise);
                }
            });
    
            await Promise.all(filePromises);
    
            const allTextFiles = allFiles.filter(file => 
                !file.path.startsWith('__MACOSX/') && 
                !file.path.endsWith('.DS_Store') &&
                !file.path.endsWith('/')
            );
    
            self.postMessage({ type: 'unzip_complete', payload: { allTextFiles } });
    
          } catch (error: any) {
            self.postMessage({ type: 'error', payload: { error: 'Failed to process ZIP file: ' + error.message, path: null } });
          }
        break;

    case 'start_analysis':
      currentProcessingQueue = payload.filesToProcess;
      fileIndex = 0;
      isPaused = false;
      processNextFile();
      break;

    case 'pause':
      isPaused = true;
      break;
      
    case 'resume':
      if (isPaused) {
        isPaused = false;
        processNextFile();
      }
      break;
  }
};
