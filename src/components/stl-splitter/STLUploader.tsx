'use client';

import React, { useRef } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { parseSTL, validateSTLFile } from '@/lib/stl-splitter/stl-parser';
import { Upload } from 'lucide-react';

export function STLUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setGeometry = useSTLSplitterStore((state) => state.setGeometry);
  const setLoading = useSTLSplitterStore((state) => state.setLoading);
  const setError = useSTLSplitterStore((state) => state.setError);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleParse = async (file: File) => {
    console.log('🔧 STLUploader: Starting parse for', file.name);
    const validation = validateSTLFile(file);
    console.log('✅ Validation result:', validation);
    if (!validation.valid) {
      const errorMsg = validation.error || 'Invalid STL file';
      console.error('❌ Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    try {
      console.log('⏳ Starting STL parse...');
      setLoading(true);
      setError(null);
      const result = await parseSTL(file);
      console.log('✅ Parse complete. Geometry:', result.geometry);
      setGeometry(result.geometry, file.name);
      console.log('✅ Mode switched to painting');
      setLoading(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse STL';
      console.error('❌ Parse error:', msg, error);
      setError(msg);
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    handleParse(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        onChange={(e) => handleFileSelect(e.target.files?.[0])}
        className="hidden"
      />

      <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
      <h3 className="font-semibold text-lg mb-2">Enviar modelo STL</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Arraste e solte seu arquivo STL aqui ou clique para escolher
      </p>
      <p className="text-xs text-gray-500">Máx 50MB • Formato binário ou ASCII</p>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
      >
        Selecionar arquivo
      </button>
    </div>
  );
}
