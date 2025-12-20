'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface BiosFile {
  name: string;
  size: number;
  modified: string;
}

export default function PlatformsPage() {
  const [activeTab, setActiveTab] = useState('amiga');
  const [files, setFiles] = useState<BiosFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'amiga') {
      loadBiosFiles('amiga');
    }
  }, [activeTab]);

  const loadBiosFiles = async (platformId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/platforms/${platformId}/bios`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load BIOS files:', error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      setUploading(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/platforms/amiga/bios`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setMessage({ type: 'success', text: 'BIOS files uploaded successfully' });
      loadBiosFiles('amiga');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload files' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Platform Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-8">
        <button
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'amiga'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('amiga')}
        >
          Amiga
        </button>
        {/* Add more tabs here later */}
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      {activeTab === 'amiga' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Amiga Kickstart ROMs</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload Kickstart ROM files required for Amiga emulation. These files will be mapped to the emulator container.
            Common files include <code>kick34005.A500</code>, <code>kick40068.A1200</code>, etc.
          </p>

          <div className="mb-8">
            <label className="block text-sm font-medium mb-2">Upload ROM Files</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  dark:file:bg-blue-900 dark:file:text-blue-200
                "
              />
              {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Uploaded Files</h3>
            {files.length === 0 ? (
              <p className="text-gray-500 italic">No BIOS files uploaded yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {files.map((file) => (
                      <tr key={file.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(file.modified).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
