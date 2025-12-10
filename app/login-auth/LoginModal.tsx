'use client';
import { useState, cloneElement, isValidElement } from 'react';
import ModalWrapper from '@/components/modals/ModalWrapper';
import AuthForm from './components/AuthForm';

export default function LoginModal({
  trigger,
  onClose,
  onAuth,
  defaultTab,
}: {
  trigger?: React.ReactNode;
  onClose?: () => void;
  onAuth?: (user: Record<string, unknown> | null) => void;
  defaultTab?: 'login' | 'register';
}) {
  const [open, setOpen] = useState(() => (trigger ? false : true));

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  const handleAuth = (user: Record<string, unknown> | null) => {
    onAuth?.(user);
    handleClose();
  };

  return (
    <>
      {trigger ? (
        isValidElement(trigger) ? (
          // clone trigger to attach open handler
          cloneElement(trigger as React.ReactElement, { onClick: () => setOpen(true) })
        ) : (
          <button onClick={() => setOpen(true)}>{trigger}</button>
        )
      ) : null}

      <ModalWrapper
        isOpen={open}
        onClose={handleClose}
        panelClassName="max-w-md w-full"
        backdropClassName="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95"
      >
        <div className="relative bg-transparent">
          <button
            className="absolute z-50 top-5 right-5 bg-white hover:bg-slate-100 text-slate-700 rounded-full w-9 h-9 flex items-center justify-center"
            onClick={handleClose}
            aria-label="Close login modal"
            title="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="login-modal-title"
            tabIndex={-1}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <header className="mb-4 text-center">
              <h2 id="login-modal-title" className="text-2xl font-bold text-slate-900">
                Welcome back
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Sign in to access your saved creatives, folders and insights.
              </p>
            </header>

            <AuthForm onAuth={handleAuth} initialTab={defaultTab} />
          </div>
        </div>
      </ModalWrapper>
    </>
  );
}
