"use client";
import { useState, useEffect } from "react";
import AuthForm from "./AuthForm";

export default function LoginModal({ trigger, onClose, onAuth }: { trigger?: React.ReactNode; onClose?: () => void; onAuth?: (user: any) => void }) {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  const handleAuth = (user: any) => {
    if (onAuth) onAuth(user);
    handleClose();
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  return open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="max-w-md w-full">
        <div className="relative bg-transparent">
          <button
            className="absolute -top-3 -right-3 bg-white hover:bg-slate-100 text-slate-700 rounded-full w-9 h-9 flex items-center justify-center shadow-md"
            onClick={handleClose}
            aria-label="Close login modal"
            title="Close"
          >
            ×
          </button>

          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
            <header className="mb-4 text-center">
              <h2 id="login-modal-title" className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-600 mt-1">Sign in to access your saved creatives, folders and insights.</p>
            </header>

            <AuthForm onAuth={handleAuth} />
          </div>
        </div>
      </div>
    </div>
  ) : null;
}
