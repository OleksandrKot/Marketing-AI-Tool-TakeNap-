'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SearchButtonProps = {
  label: string;
  onClick: () => void | Promise<void>;
  showSignInTip: boolean;
};

export function SearchButton({ label, onClick, showSignInTip }: SearchButtonProps) {
  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-md">
        {showSignInTip && (
          <div className="absolute -top-9 right-0 bg-black text-white text-xs px-3 py-1 rounded shadow-md z-20">
            Sign in to search
          </div>
        )}

        <Button
          onClick={onClick}
          disabled={true}
          title={showSignInTip ? 'Disabled' : 'Disabled'}
          className="h-10 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded w-full text-center"
        >
          <Search className="h-4 w-4 mr-2 inline" />
          {label}
        </Button>
      </div>
    </div>
  );
}
