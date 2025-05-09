// src/App.tsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mindmapRef = useRef<HTMLDivElement>(null);

  const handleGenerateMindmap = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/generate-mindmap`, {
        topic,
      });
      setMarkdown(response.data.markdown);
    } catch (err) {
      console.error('Error generating mindmap:', err);
      setError('Failed to generate mindmap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPNG = () => {
    if (mindmapRef.current) {
      html2canvas(mindmapRef.current).then((canvas) => {
        const link = document.createElement('a');
        link.download = 'mindmap.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  };

  const handleExportSVG = () => {
    if (mindmapRef.current) {
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${mindmapRef.current.innerHTML}</div>
          </foreignObject>
        </svg>
      `;
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = 'mindmap.svg';
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-1/5 p-4 bg-gray-200">
        <label className="block mb-2 font-semibold">Topic:</label>
        <input
          type="text"
          className="w-full p-2 mb-4 border rounded"
          placeholder="Enter your topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isLoading}
        />
        <button
          className={`w-full p-2 mb-4 text-white rounded ${
            isLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
          }`}
          onClick={handleGenerateMindmap}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
        <button
          className="w-full p-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600"
          onClick={handleExportPNG}
        >
          Export as PNG
        </button>
        <button
          className="w-full p-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600"
          onClick={handleExportSVG}
        >
          Export as SVG
        </button>
      </div>
      <div className="w-4/5 p-4">
        <h1 className="text-2xl font-bold text-center mb-4">MindMap Maker</h1>
        <div ref={mindmapRef} className="w-full h-[80vh] border bg-white overflow-auto">
          <pre>{markdown}</pre>
        </div>
      </div>
      <footer className="w-full p-2 bg-gray-200 text-center text-gray-600 text-sm">
        © 2025 MindMap Maker. All rights reserved.
      </footer>
    </div>
  );
};

export default App;