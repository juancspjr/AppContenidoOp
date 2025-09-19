/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

// FIX: Added a component stub to make this a valid module.
interface EditorCanvasProps {
    initialFiles: File[];
    onExit: () => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({ initialFiles, onExit }) => {
    // This is a placeholder implementation.
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Editor Canvas</h1>
            <p>Loaded {initialFiles.length} file(s).</p>
            <button
                onClick={onExit}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
            >
                Exit
            </button>
        </div>
    );
};

export default EditorCanvas;
