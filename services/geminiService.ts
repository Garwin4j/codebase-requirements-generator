import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from '../constants';
import type { FileAnalysis } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function withRetry<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error(`${operationName} failed after ${MAX_RETRIES} retries:`, error);
        throw error;
      }
      console.warn(`Attempt ${retries} for ${operationName} failed. Retrying...`, error);
      const delayTime = INITIAL_DELAY_MS * Math.pow(2, retries - 1) + Math.random() * 1000;
      await delay(delayTime);
    }
  }
}

export const analyzeFileContent = async (path: string, content: string): Promise<string> => {
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
  }, `analyzeFileContent for ${path}`);
};

export const generateRequirementsDocument = async (analyses: FileAnalysis[]): Promise<string> => {
  return withRetry(async () => {
    const formattedAnalyses = analyses
      .map(a => `### File: \`${a.path}\`\n\n${a.analysis}`)
      .join('\n\n---\n\n');

    const prompt = `
      You are a senior software architect tasked with creating a comprehensive software requirements document.
      You have been provided with an automated analysis of every file in a .NET and React application's codebase.
      Your job is to synthesize these individual analyses into a single, well-structured, and professional requirements document.
      The final document should be detailed enough for a new development team to understand and recreate the application.

      Structure the document in Markdown format with the following sections:

      # Software Requirements Document

      ## 1. Introduction & System Overview
      Provide a high-level summary of the application's purpose. Infer this from the combined analyses of frontend and backend components.

      ## 2. Technical Architecture
      Describe the overall architecture. Explain that it's a .NET backend with a React frontend, and detail how they likely communicate (e.g., RESTful API). Mention key technologies or libraries identified in the file analyses.

      ## 3. Backend Functionality (.NET)
      Synthesize the analyses of all .NET files (e.g., .cs, .csproj). Describe the API endpoints, data models (POCOs), business logic (services), database context, and overall structure. Be as specific as possible about what the backend does.

      ## 4. Frontend Functionality (React)
      Synthesize the analyses of all React/frontend files (e.g., .tsx, .ts, .jsx, .js, .css). Describe the component hierarchy, state management strategy, user interface, user flows, and how it interacts with the backend API.

      ## 5. Key Features
      Create a bulleted list of the main features and functionalities of the application. This should be a clear, concise summary of what the user can do.

      ## 6. Data Schema
      Based on the .NET data models and database context files, infer and describe the likely database schema. You can represent this as a list of tables with their columns and relationships.

      ---

      Here is the file-by-file analysis to use as your source material:
      
      ${formattedAnalyses}
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
          temperature: 0.2,
      },
    });
    return response.text;
  }, 'generateRequirementsDocument');
};