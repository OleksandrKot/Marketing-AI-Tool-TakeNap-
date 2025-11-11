/* eslint-disable @typescript-eslint/no-explicit-any */
// Lightweight, dependency-free `cn` helper.
// We avoid importing `clsx` / `tailwind-merge` here to prevent runtime
// interop issues during the Next.js server build. This function merges

import React from 'react';

// className inputs safely and returns a single string.
export function cn(...inputs: unknown[]) {
  return inputs.flat(Infinity).filter(Boolean).map(String).join(' ').replace(/\s+/g, ' ').trim();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Safely extract an array of items from an API response which may be either
// an array or an object with a `data` array (common supabase-style response).
// Returns an empty array for any other shape.
export function extractDataArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw !== null && typeof raw === 'object' && 'data' in raw) {
    const candidate = (raw as { data: unknown }).data;
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
}

export const useScrollbarWidth = () => {
  const computed = React.useRef(false);
  const widthRef = React.useRef(0);

  if (computed.current) return widthRef.current;

  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  // msOverflowStyle is a legacy IE/Edge property; set via bracket to avoid TS property checks
  const styleRef = outer.style as unknown as Record<string, unknown>;
  styleRef['msOverflowStyle'] = 'scrollbar';
  // Some environments may use a differently-cased legacy key; set both to be safe
  styleRef['msoverflowStyle'] = 'scrollbar';
  document.body.appendChild(outer);

  const inner = document.createElement('div');
  outer.appendChild(inner);
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  outer.parentNode?.removeChild(outer);

  computed.current = true;
  widthRef.current = scrollbarWidth;

  return scrollbarWidth;
};
