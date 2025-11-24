'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/inputs/DatePicker';

export function DateRangeCard() {
  const [selectedDateRange, setSelectedDateRange] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <Card className="border-slate-200 rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300">
      <CardContent className="p-6 flex items-center space-x-4">
        <div className="p-3 bg-white rounded-xl">
          <Calendar className="h-6 w-6 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">Date of Creation</p>
          <DatePicker
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            isOpen={isDatePickerOpen}
            onToggle={() => setIsDatePickerOpen((prev) => !prev)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
