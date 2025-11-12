import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const CollapsiblePanel = ({
  title,
  defaultOpen = false,
  actions,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <Card className="border-slate-200 rounded-2xl">
      <CardContent className="p-0">
        <div className="bg-red-50 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <div className="flex items-center space-x-3">
              {actions}
              <Button variant="ghost" size="sm" onClick={() => setOpen((s) => !s)}>
                {open ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </div>
        {open ? <div className="p-6">{children}</div> : null}
      </CardContent>
    </Card>
  );
};

export default CollapsiblePanel;
