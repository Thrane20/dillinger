'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface GameFormData {
  title: string;
  filePath: string;
  platformId: string;
  tags: string;
  metadata: {
    description?: string;
    genre?: string;
    developer?: string;
    publisher?: string;
  };
}

export default function AddGameForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    filePath: '',
    platformId: 'native',
    tags: '',
    metadata: {
      description: '',
      genre: '',
      developer: '',
      publisher: '',
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Convert tags string to array
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          filePath: formData.filePath,
          platformId: formData.platformId,
          tags,
          collectionIds: [],
          metadata: formData.metadata,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add game');
      }

      // Success! Redirect to games list
      router.push('/games');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name.startsWith('metadata.')) {
      const metadataKey = name.split('.')[1] as keyof GameFormData['metadata'];
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataKey]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Add New Game</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter game title"
          />
        </div>

        {/* File Path */}
        <div className="mb-4">
          <label htmlFor="filePath" className="block text-sm font-medium text-gray-700 mb-2">
            File Path *
          </label>
          <input
            type="text"
            id="filePath"
            name="filePath"
            required
            value={formData.filePath}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/path/to/game/executable"
          />
        </div>

        {/* Platform */}
        <div className="mb-4">
          <label htmlFor="platformId" className="block text-sm font-medium text-gray-700 mb-2">
            Platform *
          </label>
          <select
            id="platformId"
            name="platformId"
            required
            value={formData.platformId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="native">Native (Linux)</option>
            <option value="wine">Wine (Windows)</option>
            <option value="proton">Proton (Steam)</option>
            <option value="dosbox">DOSBox</option>
            <option value="scummvm">ScummVM</option>
          </select>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="action, rpg, multiplayer (comma-separated)"
          />
        </div>

        {/* Metadata Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-4">Additional Information</h3>

          {/* Description */}
          <div className="mb-4">
            <label htmlFor="metadata.description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="metadata.description"
              name="metadata.description"
              value={formData.metadata.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the game"
            />
          </div>

          {/* Genre */}
          <div className="mb-4">
            <label htmlFor="metadata.genre" className="block text-sm font-medium text-gray-700 mb-2">
              Genre
            </label>
            <input
              type="text"
              id="metadata.genre"
              name="metadata.genre"
              value={formData.metadata.genre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Action, RPG, Strategy"
            />
          </div>

          {/* Developer */}
          <div className="mb-4">
            <label htmlFor="metadata.developer" className="block text-sm font-medium text-gray-700 mb-2">
              Developer
            </label>
            <input
              type="text"
              id="metadata.developer"
              name="metadata.developer"
              value={formData.metadata.developer}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Game developer"
            />
          </div>

          {/* Publisher */}
          <div className="mb-4">
            <label htmlFor="metadata.publisher" className="block text-sm font-medium text-gray-700 mb-2">
              Publisher
            </label>
            <input
              type="text"
              id="metadata.publisher"
              name="metadata.publisher"
              value={formData.metadata.publisher}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Game publisher"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Adding Game...' : 'Add Game'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/games')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
