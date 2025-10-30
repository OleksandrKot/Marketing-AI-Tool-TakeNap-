"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthForm from "./AuthForm";

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function LoginModal({ open = true, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedTab, setSelectedTab] = React.useState<'login' | 'register'>('login');

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose?.();
      }
    }

    // Lock page scroll and compensate layout to avoid horizontal shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    // lock scrolling on the root element
    document.documentElement.style.overflow = 'hidden';
    // add padding to body to compensate for removed scrollbar (only if > 0)
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Set up event listeners
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
  document.documentElement.style.overflow = '';
  if (document.body.style.paddingRight) document.body.style.paddingRight = '';
    };
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const nodes = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelectors))
      .filter((n): n is HTMLElement => n.offsetParent !== null);
      
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (first) {
      first.focus();
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) return null;

  const modalContent = (
    <>
      {/* Backdrop (portal) */}
      <div
        className="fixed inset-0 z-[9998] bg-[rgba(0,0,0,0.6)] pointer-events-auto"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
        <div
          ref={modalRef}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Welcome</h3>
              <p className="text-sm text-slate-500">Sign in or create an account</p>
            </div>
            <button
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              onClick={() => onClose?.()}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-4">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSelectedTab('login')}
                className={`flex-1 py-2 text-center font-medium rounded-lg transition-colors ${selectedTab === 'login' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('register')}
                className={`flex-1 py-2 text-center font-medium rounded-lg transition-colors ${selectedTab === 'register' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Body (form) */}
          <div className="px-5 pb-6 pt-4">
            <AuthForm
              tab={selectedTab}
              onTabChange={(t) => setSelectedTab(t)}
              hideTabs
              noWrapper
              onAuth={() => onClose?.()}
            />
          </div>
        </div>
      </div>
    </>
  );

  // Render into document.body to ensure overlay covers everything
  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}