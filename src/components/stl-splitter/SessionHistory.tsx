'use client';

import React from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { RotateCcw, Trash2, ChevronDown } from 'lucide-react';

export function SessionHistory() {
  const sessions = useSTLSplitterStore((state) => state.sessions);
  const deleteSession = useSTLSplitterStore((state) => state.deleteSession);
  const loadSession = useSTLSplitterStore((state) => state.loadSession);
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-300 dark:border-gray-700 mt-4 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full p-2 text-left font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        Sessões salvas ({sessions.length})
      </button>

      {isExpanded && (
        <div className="space-y-2 mt-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm"
            >
              <div className="flex-1">
                <p className="font-medium">{session.originalFileName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(session.timestamp).toLocaleDateString()}{' '}
                  {new Date(session.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {session.metadata.colorGroupCount} partes • {session.metadata.faceCount.toLocaleString()} faces
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadSession(session.id)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition"
                  title="Restaurar sessão"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteSession(session.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition"
                  title="Excluir sessão"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
