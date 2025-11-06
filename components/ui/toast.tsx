'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error'; ttl?: number };

type ToastContextValue = {
  showToast: (t: { message: string; type?: 'success' | 'error'; ttl?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (t: { message: string; type?: 'success' | 'error'; ttl?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const toast: Toast = {
        id,
        message: t.message,
        type: t.type || 'success',
        ttl: t.ttl || 3500,
      };
      setToasts((s) => [...s, toast]);
      // auto-remove
      setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), toast.ttl);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div aria-live="polite" className="fixed bottom-6 right-6 z-60 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full rounded-lg px-4 py-2 shadow-lg flex items-center gap-3 ${
              t.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="text-sm">{t.message}</div>
            <button
              onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
              className="ml-auto text-xs opacity-70"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
