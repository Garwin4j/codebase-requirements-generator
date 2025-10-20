import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';

interface RequirementsDocumentProps {
  document: string;
  onReset: () => void;
}

const RequirementsDocument: React.FC<RequirementsDocumentProps> = ({ document, onReset }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');

  const handleCopy = () => {
    navigator.clipboard.writeText(document).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-100">Generated Document</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold text-sm transition-colors"
          >
            <ClipboardIcon className="w-4 h-4 mr-2" />
            {copyButtonText}
          </button>
          <button
            onClick={onReset}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold text-sm transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Start Over
          </button>
        </div>
      </div>
      <div className="prose prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none bg-gray-900/50 p-6 rounded-lg border border-gray-700 h-[60vh] overflow-y-auto">
        <ReactMarkdown>{document}</ReactMarkdown>
      </div>
    </div>
  );
};

export default RequirementsDocument;
