'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DatePickerProps {
  selectedDateRange: string | null;
  onDateRangeChange: (range: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

export function DatePicker({
  selectedDateRange,
  onDateRangeChange,
  isOpen,
  onToggle,
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  // removed unused `isSelectingEnd` state to satisfy lint rules

  const quickOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last week', value: 'last_week' },
    { label: '30 days', value: '30_days' },
    { label: 'This month', value: 'this_month' },
    { label: 'Last month', value: 'last_month' },
    { label: '3 months ago', value: '3_months' },
    { label: '6 months ago', value: '6_months' },
    { label: '12 months ago', value: '12_months' },
    { label: 'All time', value: 'all_time' },
  ];

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + 1);
    return nextMonth;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isDateInRange = (date: Date, start: Date, end: Date) => {
    return date >= start && date <= end;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  const handleDateClick = (date: Date) => {
    if (!dateRange.start || (dateRange.start && dateRange.end)) {
      // Start new selection
      setDateRange({ start: date, end: null });
      onDateRangeChange(null); // Clear quick selection
    } else if (dateRange.start && !dateRange.end) {
      // Complete the range
      if (date >= dateRange.start) {
        setDateRange({ start: dateRange.start, end: date });
      } else {
        setDateRange({ start: date, end: dateRange.start });
      }
    }
  };

  const getDatePosition = (date: Date, calendarDate: Date) => {
    const firstDay = getFirstDayOfMonth(calendarDate);
    const day = date.getDate();
    const dayOfWeek = (firstDay + day - 1) % 7;
    const weekNumber = Math.floor((firstDay + day - 1) / 7);

    return { dayOfWeek, weekNumber, day };
  };

  const isFirstInRow = (date: Date, calendarDate: Date) => {
    if (!dateRange.start || !dateRange.end) return false;
    const { dayOfWeek } = getDatePosition(date, calendarDate);

    // Check if this is the first date in the range for this row
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);

    for (let i = 0; i < dayOfWeek; i++) {
      const checkDate = new Date(startOfWeek);
      checkDate.setDate(startOfWeek.getDate() + i);
      if (
        checkDate.getMonth() === date.getMonth() &&
        isDateInRange(checkDate, dateRange.start, dateRange.end)
      ) {
        return false;
      }
    }
    return true;
  };

  const isLastInRow = (date: Date, calendarDate: Date) => {
    if (!dateRange.start || !dateRange.end) return false;
    const { dayOfWeek } = getDatePosition(date, calendarDate);

    // Check if this is the last date in the range for this row
    for (let i = dayOfWeek + 1; i < 7; i++) {
      const checkDate = new Date(date);
      checkDate.setDate(date.getDate() + (i - dayOfWeek));
      if (
        checkDate.getMonth() === date.getMonth() &&
        isDateInRange(checkDate, dateRange.start, dateRange.end)
      ) {
        return false;
      }
    }
    return true;
  };

  const renderCalendar = (date: Date) => {
    const daysInMonth = getDaysInMonth(date);
    const firstDay = getFirstDayOfMonth(date);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-10 h-10"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
      const isStart = dateRange.start && isSameDay(currentDate, dateRange.start);
      const isEnd = dateRange.end && isSameDay(currentDate, dateRange.end);
      const isInRange =
        dateRange.start &&
        dateRange.end &&
        isDateInRange(currentDate, dateRange.start, dateRange.end) &&
        !isStart &&
        !isEnd;
      const isTodayDate = isToday(currentDate);
      const isFirstInRowRange = isFirstInRow(currentDate, date);
      const isLastInRowRange = isLastInRow(currentDate, date);

      let buttonClasses =
        'w-10 h-10 text-sm transition-colors flex items-center justify-center relative font-medium tracking-wide';
      let backgroundClasses = ''; // Reset for each iteration

      if (isStart || isEnd) {
        buttonClasses += ' bg-blue-500 text-white hover:bg-blue-600 rounded-lg z-10 relative';
      } else if (isInRange) {
        buttonClasses += ' text-slate-900 hover:bg-blue-200 z-10 relative';
        // Add background for range
        backgroundClasses = 'absolute inset-0 bg-blue-100';
        if (isFirstInRowRange) {
          backgroundClasses += ' rounded-l-lg';
        }
        if (isLastInRowRange) {
          backgroundClasses += ' rounded-r-lg';
        }
      } else {
        buttonClasses += ' text-slate-900 hover:bg-blue-50 rounded-lg';
      }

      if (isTodayDate && !isStart && !isEnd) {
        buttonClasses += ' border-2 border-slate-400';
      }

      days.push(
        <button key={day} className={buttonClasses} onClick={() => handleDateClick(currentDate)}>
          {backgroundClasses && <div className={backgroundClasses}></div>}
          <span className="relative z-10">{day}</span>
        </button>
      );
    }

    return days;
  };

  const formatDisplayValue = () => {
    if (selectedDateRange) {
      const option = quickOptions.find((opt) => opt.value === selectedDateRange);
      return option?.label || 'Custom range';
    }
    if (dateRange.start && dateRange.end) {
      const startStr = dateRange.start.toLocaleDateString('en-GB');
      const endStr = dateRange.end.toLocaleDateString('en-GB');
      return `${startStr} - ${endStr}`;
    }
    if (dateRange.start) {
      const startStr = dateRange.start.toLocaleDateString('en-GB');
      return `${startStr} - ...`;
    }
    return 'DD.MM.YYYY - DD.MM.YYYY';
  };

  return (
    <div className="relative">
      <div
        className={`w-full h-9 px-3 py-2 border-2 ${
          isOpen ? 'border-blue-500' : 'border-slate-200'
        } rounded-lg bg-white flex items-center justify-between cursor-pointer text-sm text-slate-700 select-none`}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span>{formatDisplayValue()}</span>
        <Calendar className="h-4 w-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-6 min-w-[800px]">
          <div className="flex gap-8">
            {/* Quick Options */}
            <div className="flex-shrink-0">
              <div className="grid grid-cols-2 gap-2 w-64">
                {quickOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedDateRange === option.value ? 'default' : 'outline'}
                    size="sm"
                    className={`justify-start text-sm h-8 transition-colors ${
                      selectedDateRange === option.value
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-700'
                    }`}
                    onClick={() => {
                      onDateRangeChange(option.value);
                      setDateRange({ start: null, end: null });
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
                <div className="flex gap-20">
                  <h3 className="font-semibold text-lg text-slate-900">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <h3 className="font-semibold text-lg text-slate-900">
                    {monthNames[getNextMonth().getMonth()]} {getNextMonth().getFullYear()}
                  </h3>
                </div>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <ChevronRight className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <div className="flex gap-20">
                {/* Current Month */}
                <div>
                  <div className="grid grid-cols-7 gap-4 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                      <div
                        key={day}
                        className="w-10 h-10 text-sm text-slate-500 flex items-center justify-center font-medium"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-4">{renderCalendar(currentMonth)}</div>
                </div>

                {/* Next Month */}
                <div>
                  <div className="grid grid-cols-7 gap-4 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                      <div
                        key={day}
                        className="w-10 h-10 text-sm text-slate-500 flex items-center justify-center font-medium"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-4">{renderCalendar(getNextMonth())}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
