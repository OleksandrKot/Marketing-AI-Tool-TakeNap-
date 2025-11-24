'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { StatsBarProps } from './StatsBar';

type Props = Pick<
  StatsBarProps,
  | 'totalAds'
  | 'videoAds'
  | 'uniquePages'
  | 'value'
  | 'onChange'
  | 'onEnterPress'
  | 'numberToScrape'
  | 'setNumberToScrape'
>;

export function CompetitorSearchCard({
  totalAds,
  videoAds,
  uniquePages,
  value,
  onChange,
  onEnterPress,
  numberToScrape = 10,
  setNumberToScrape = () => {},
}: Props) {
  const [competitorLink, setCompetitorLink] = useState('');
  const [scrapeInput, setScrapeInput] = useState<string>(String(numberToScrape ?? 10));
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value !== undefined) {
      setCompetitorLink(value);
    }
  }, [value]);

  useEffect(() => {
    const handler = () => {
      setCompetitorLink('');
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    };
    window.addEventListener('productFilterCleared', handler as EventListener);
    return () => window.removeEventListener('productFilterCleared', handler as EventListener);
  }, []);

  const validateScrapeInput = (raw: string) => {
    if (raw.trim() === '') {
      setScrapeError('Enter a number');
      return false;
    }
    const asNum = parseInt(raw, 10);
    if (Number.isNaN(asNum)) {
      setScrapeError('Invalid number');
      return false;
    }
    if (asNum < 1 || asNum > 1000) {
      setScrapeError('Enter a number between 1 and 1000');
      return false;
    }
    setScrapeError(null);
    return true;
  };

  const commitScrapeValue = (raw: string) => {
    if (!validateScrapeInput(raw)) return;
    const asNum = parseInt(raw, 10);
    setNumberToScrape?.(asNum);
  };

  return (
    <Card className="border-slate-200 items-center rounded-2xl hover:shadow-md transition-all duration-300 hover:border-slate-300">
      <CardContent className="p-6 pt-6 flex items-center space-x-4">
        <div className="p-3  bg-blue-50 rounded-xl">
          <Eye className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-2">Search Products</p>
          <p className="text-xs text-slate-400 mb-2">
            {totalAds} ads • {videoAds} videos • {uniquePages} pages
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Product name or Meta Ad Library link..."
              ref={inputRef}
              value={value !== undefined ? value : competitorLink}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (onChange) {
                  onChange(nextValue);
                } else {
                  setCompetitorLink(nextValue);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onEnterPress?.();
                }
              }}
              className="border-slate-200 rounded-lg h-9 text-sm text-slate-700 placeholder:text-slate-500 bg-slate-50 pl-10"
            />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-400 mb-1">Number of creatives to fetch</p>
            <Input
              type="number"
              min={1}
              max={1000}
              value={scrapeInput}
              aria-invalid={!!scrapeError}
              onChange={(e) => {
                const raw = e.target.value;
                setScrapeInput(raw);
                if (raw.trim() === '') {
                  setScrapeError('Enter a number');
                } else {
                  validateScrapeInput(raw);
                }
              }}
              onBlur={() => {
                if (!scrapeInput || scrapeInput.trim() === '') {
                  setScrapeInput(String(numberToScrape ?? 10));
                  setScrapeError(null);
                  return;
                }
                commitScrapeValue(scrapeInput);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!scrapeInput || scrapeInput.trim() === '') {
                    setScrapeInput(String(numberToScrape ?? 10));
                    setScrapeError(null);
                    return;
                  }
                  commitScrapeValue(scrapeInput);
                }
              }}
              className={`border-slate-200 rounded-lg h-9 text-sm text-slate-700 w-40 ${
                scrapeError ? 'border-red-500' : ''
              }`}
            />
            {scrapeError && <div className="text-xs text-red-600 mt-1">{scrapeError}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
