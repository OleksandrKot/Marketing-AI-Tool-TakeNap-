'use client';

import React from 'react';

export default function ModalLoading() {
  return (
    <div className="flex items-center justify-center p-4">
      <div
        className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
