import React, { useState } from 'react';

export default function App() {
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState('docx');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  const formats = ['pdf', 'docx', 'png', 'jpg', 'txt'];

  //handler for Drag & Drop
  const handleDrop = (e) => {
    e.preventDefault(); // to stop browser from reloading
    if (e.dataTransfer.files)
      setFiles(Array.from(e.dataTransfer.files)); //setting files as array
  };

  const handleConvert = async () => { // convertion making
    if (!files.length) return;  // if no files no action
    setConverting(true);
    setError('');

    const formData = new FormData(); // empty FormData obj. 
    files.forEach(f => formData.append('files', f));// using same key "files" to upload multiple files
    formData.append('format', format);// another key for formats

    try {
      const res = await fetch('http://localhost:5000/convert', { //backend API calling
        method: 'POST', //sending data
        body: formData,
      });

      if (!res.ok) throw new Error((await res.json()).error);

      const blob = await res.blob(); // binary in JS called blob
      const url = URL.createObjectURL(blob); // creating temporary URL for blob(browser memory address)
      const a = document.createElement('a');// anchor tag
      a.href = url; // // setting a tag to href for download
      a.download = 'converted.zip'; // for saving everytime this name.zip
      a.click();// download sart
      URL.revokeObjectURL(url);// free that temp URL
      setFiles([]);
    } catch (err) {
      setError(err.message);
    }
    setConverting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl p-8 w-full max-w-lg rounded-3xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">File Converter</h1>

        <div
          className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl p-10 text-center mb-6 hover:border-blue-400 transition"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p className="text-gray-700 font-medium mb-3">Drag files here or click to browse</p>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="text-sm"
          />
        </div>

        {files.length > 0 && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4">
            <p className="font-semibold mb-2 text-gray-700">{files.length} file(s) selected</p>
            {files.map((f, i) => (
              <div key={i} className="text-sm text-gray-600 py-1">{f.name}</div>
            ))}
          </div>
        )}

        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="w-full border-2 border-gray-300 rounded-xl p-3 mb-6 focus:border-blue-500 focus:outline-none"
        >
          {formats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        <button
          onClick={handleConvert}
          disabled={!files.length || converting}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:shadow-lg transition mb-3"
        >
          {converting ? 'Loading ZIP...' : 'Convert'}
        </button>

        {files.length > 0 && (
          <button
            onClick={() => setFiles([])}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}