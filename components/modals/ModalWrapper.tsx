'use client';

import { useScrollbarWidth } from '@/lib/core/utils';
import { useEffect, useRef } from 'react';

type Props = {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
};

export default function ModalWrapper({
  isOpen,
  onClose,
  children,
  panelClassName,
  backdropClassName,
}: Props) {
  const scrollbarWidth = useScrollbarWidth();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const hadHtmlClass = html.classList.contains('modal-open');
    const hadBodyClass = body.classList.contains('modal-open');
    console.log(scrollbarWidth);
    html.style.setProperty('padding-right', `${scrollbarWidth}px`);

    if (isOpen) {
      html.classList.add('modal-open');
      body.classList.add('modal-open');
    }

    return () => {
      if (!hadHtmlClass) html.classList.remove('modal-open');
      if (!hadBodyClass) body.classList.remove('modal-open');
      html.style.removeProperty('padding-right');
      body.style.overflow = prevOverflow || '';
    };
  }, [isOpen]);

  // Close on Escape key when modal is open (attach to document to avoid adding
  // keyboard handlers on non-interactive elements).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Track whether the pointerdown originated on the backdrop so we only close
  // when the interaction both started and ended on the backdrop.
  const pointerDownOnBackdropRef = useRef<boolean>(false);

  // If modal is not open, do not render anything. We still rely on the
  // useEffect cleanup above to restore scroll state when isOpen flips false.
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop uses click to close when clicking outside the panel. We handle Escape on document.
          This is a presentational overlay; keyboard handling is handled globally to avoid adding
          tabIndex/keyboard handlers to a non-interactive element. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={
          backdropClassName ??
          'fixed inset-0 z-50 flex items-center justify-center bg-black/40 !m-0 !mx-0'
        }
        role="dialog"
        aria-modal="true"
        // Only close when the pointer-down started on the backdrop and the
        // final click/up also happens on the backdrop. This avoids closing the
        // modal when a user starts an interaction (e.g. drag/resize) inside
        // the panel and releases the pointer outside the window.
        onPointerDown={(e) => {
          // store whether the pointerdown originated on the backdrop
          (pointerDownOnBackdropRef.current as boolean) = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && pointerDownOnBackdropRef.current) onClose?.();
          // reset flag after handling click
          pointerDownOnBackdropRef.current = false;
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className={panelClassName ?? 'max-w-md w-full'} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </>
  );
}
