'use client';

import { Button } from '@/components/ui/button';

type RequestLog = {
  id?: string;
  time?: string;
  type?: string;
  text?: string;
  meta?: Record<string, unknown>;
};

type RequestLogsPanelProps = {
  logs: RequestLog[];
  onClear: () => void;
};

export function RequestLogsPanel({ logs, onClear }: RequestLogsPanelProps) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mb-6 border rounded-xl p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700">Журнал подій</p>
        <Button
          onClick={onClear}
          className="h-7 px-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800"
        >
          Очистити журнали
        </Button>
      </div>
      <div className="max-h-48 overflow-auto text-sm text-slate-700">
        {logs.map((log) => (
          <div key={log.id || log.time} className="mb-2 p-2 bg-slate-50 rounded">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-slate-500">
                {log.time ? new Date(log.time).toLocaleString() : ''}
              </div>
              <div className="text-xs font-medium text-slate-600">{log.type || ''}</div>
            </div>
            <div className="mt-1 text-slate-800">{log.text}</div>
            {log.meta && (
              <div className="mt-1 text-xs text-slate-500">{JSON.stringify(log.meta)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
