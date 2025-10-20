import React, { useState } from 'react';
import { Project } from '../types';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { Trash2Icon } from './icons/Trash2Icon';
import { EyeIcon } from './icons/EyeIcon';
import { PencilIcon } from './icons/PencilIcon';

interface ProjectListProps {
    projects: Project[];
    onResumeProject: (project: Project) => void;
    onViewProject: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
    onRenameProject: (projectId: string, newName: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onResumeProject, onViewProject, onDeleteProject, onRenameProject }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleStartEditing = (project: Project) => {
        setEditingId(project.id);
        setEditingName(project.projectName);
    };

    const handleCancelEditing = () => {
        setEditingId(null);
        setEditingName('');
    };

    const handleRenameConfirm = () => {
        if (editingId && editingName.trim()) {
            onRenameProject(editingId, editingName.trim());
        }
        handleCancelEditing();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        } else if (e.key === 'Escape') {
            handleCancelEditing();
        }
    };
    
    const getStatusChip = (status: Project['status']) => {
        const baseClasses = "px-2 py-0.5 text-xs font-medium rounded-full";
        switch (status) {
            case 'analyzing':
            case 'unzipping': // This status is now transient and may not be seen
            case 'generating':
                return <span className={`${baseClasses} bg-blue-900 text-blue-300`}>In Progress</span>;
            case 'paused':
                return <span className={`${baseClasses} bg-yellow-900 text-yellow-300`}>Paused</span>;
            case 'completed':
                return <span className={`${baseClasses} bg-green-900 text-green-300`}>Completed</span>;
            case 'error':
                 return <span className={`${baseClasses} bg-red-900 text-red-300`}>Error</span>;
            default:
                return null;
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    }

    const canResume = (status: Project['status']) => {
        return ['analyzing', 'paused', 'error'].includes(status);
    }

    return (
        <div className="mt-8">
            <h3 className="px-8 text-lg font-semibold text-gray-300">Recent Projects</h3>
            {projects.length === 0 ? (
                <p className="px-8 text-gray-500 mt-2">No projects found. Upload a file to get started.</p>
            ) : (
                <ul className="mt-4 divide-y divide-gray-700">
                    {projects.map(project => (
                        <li key={project.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                            <div className="flex-1 min-w-0 px-4">
                                {editingId === project.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={handleRenameConfirm}
                                        onKeyDown={handleKeyDown}
                                        autoFocus
                                        className="w-full bg-gray-900 border border-indigo-500 rounded-md px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                ) : (
                                    <p className="text-sm font-semibold text-gray-100 truncate">{project.projectName}</p>
                                )}
                                <div className="flex items-center space-x-2 mt-1">
                                    {getStatusChip(project.status)}
                                    <p className="text-xs text-gray-400">{formatDate(project.createdAt)}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                                { canResume(project.status) && (
                                     <button disabled={editingId === project.id} onClick={() => onResumeProject(project)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" title="Resume">
                                         <RefreshCwIcon className="w-4 h-4" />
                                     </button>
                                )}
                                { project.status === 'completed' && (
                                     <button disabled={editingId === project.id} onClick={() => onViewProject(project)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" title="View Document">
                                        <EyeIcon className="w-4 h-4" />
                                     </button>
                                )}
                                <button disabled={editingId === project.id} onClick={() => handleStartEditing(project)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" title="Rename">
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button disabled={editingId === project.id} onClick={() => onDeleteProject(project.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" title="Delete">
                                    <Trash2Icon className="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ProjectList;
