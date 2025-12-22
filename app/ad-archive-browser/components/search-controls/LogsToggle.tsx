'use client';

import * as RadixSwitch from '@radix-ui/react-switch';

type LogsToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
};

export function LogsToggle({ checked, onChange }: LogsToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <RadixSwitch.Root
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-slate-200'
        }`}
        checked={!!checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        aria-label="Show event logs"
      >
        <RadixSwitch.Thumb
          className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </RadixSwitch.Root>
      <span className="text-sm text-slate-700">Show event logs</span>
    </div>
  );
}
