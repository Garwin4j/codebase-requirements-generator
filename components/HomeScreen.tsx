
import React from 'react';
import FileUpload from './FileUpload';
import ProjectList from './ProjectList';
import { Project } from '../types';

interface HomeScreenProps {
    projects: Project[];
    isLoading: boolean;
    onStartNewProject: (file: File) => void;
    onResumeProject: (project: Project) => void;
    onViewProject: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
    onRenameProject: (projectId: string, newName: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
    projects,
    isLoading,
    onStartNewProject,
    onResumeProject,
    onViewProject,
    onDeleteProject,
    onRenameProject,
}) => {
    return (
        <div>
            <FileUpload onFileSelect={onStartNewProject} />
            <div className="border-t border-gray-700 mx-8"></div>
            {isLoading ? (
                <div className="p-8 text-center text-gray-400">Loading projects...</div>
            ) : (
                <ProjectList 
                    projects={projects}
                    onResumeProject={onResumeProject}
                    onViewProject={onViewProject}
                    onDeleteProject={onDeleteProject}
                    onRenameProject={onRenameProject}
                />
            )}
        </div>
    );
};

export default HomeScreen;