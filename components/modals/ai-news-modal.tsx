'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, Sparkles, TrendingUp, Zap, Smartphone, Search, Video, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ModalWrapper from './ModalWrapper';

interface AINewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingMessage: string;
}

const newsItems = [
  {
    id: 1,
    icon: TrendingUp,
    title: 'Y Combinator 2025 Summer Demo Day Results',
    content:
      "Top 5 B2B startups revealed from this year's cohort, featuring breakthrough solutions in automation and data analytics",
    category: 'Startups',
    color: 'from-blue-500 to-purple-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  {
    id: 2,
    icon: Brain,
    title: 'Notion Launches New AI Agent',
    content:
      'Revolutionary AI assistant focused on data analytics and workflow automation, transforming how teams collaborate',
    category: 'AI Tools',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  {
    id: 3,
    icon: Smartphone,
    title: 'iPhone 17 Official Launch',
    content:
      'Apple unveils next-generation iPhone with enhanced AI capabilities and breakthrough performance features',
    category: 'Hardware',
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
  {
    id: 4,
    icon: Search,
    title: 'Perplexity Secures $200M Funding',
    content:
      'AI search company raises massive funding round, valuation soars as competition with Google intensifies',
    category: 'Funding',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
  {
    id: 5,
    icon: Video,
    title: 'Bending Spoons Acquires Vimeo',
    content:
      'Italian app company purchases video platform for $1.38 billion, marking major consolidation in creator economy',
    category: 'M&A',
    color: 'from-indigo-500 to-blue-600',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
  },
];

function AINewsModalComponent({ isOpen, onClose, processingMessage }: AINewsModalProps) {
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Безпечна функція для зміни новин
  const changeNews = useCallback(() => {
    if (!isOpen) return;

    setIsAnimating(true);
    setTimeout(() => {
      setCurrentNewsIndex((prev) => {
        const nextIndex = (prev + 1) % newsItems.length;
        return nextIndex;
      });
      setIsAnimating(false);
    }, 300);
  }, [isOpen]);

  // Ефект для автоматичної зміни новин
  useEffect(() => {
    if (!isOpen) {
      // Скидаємо стан при закритті модалки
      setCurrentNewsIndex(0);
      setIsAnimating(false);
      return;
    }

    const interval = setInterval(changeNews, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, changeNews]);

  // Функція для ручної зміни новин
  const handleNewsChange = useCallback(
    (index: number) => {
      if (index >= 0 && index < newsItems.length && index !== currentNewsIndex) {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentNewsIndex(index);
          setIsAnimating(false);
        }, 300);
      }
    },
    [currentNewsIndex]
  );

  if (!isOpen) return null;

  const currentNews = newsItems[currentNewsIndex] || newsItems[0];
  const IconComponent = currentNews?.icon || TrendingUp;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} panelClassName="p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-spin-slow">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Processing Your Request</h3>
                  <p className="text-blue-100 text-sm">
                    {processingMessage || 'Working on your request...'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Loading Animation */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              <span className="text-sm text-slate-600 font-medium">
                AI is working on your request...
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* AI News Section */}
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Zap className="h-5 w-5 text-orange-500" />
              <h4 className="text-lg font-semibold text-slate-900">Latest AI Industry News</h4>
            </div>

            {/* News Item */}
            <div
              className={`transition-all duration-300 transform ${
                isAnimating
                  ? 'opacity-0 scale-95 translate-y-2'
                  : 'opacity-100 scale-100 translate-y-0'
              }`}
            >
              <div className={`${currentNews.bgColor} rounded-2xl p-6 border border-slate-200`}>
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${currentNews.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg transform hover:scale-110 transition-transform duration-200`}
                  >
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${currentNews.bgColor} ${currentNews.textColor} border`}
                      >
                        {currentNews.category}
                      </span>
                      <div className="flex space-x-1">
                        {newsItems.map((_, index) => (
                          <div
                            key={`indicator-${index}`}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              index === currentNewsIndex ? 'bg-blue-500 scale-125' : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <h5 className="text-lg font-semibold text-slate-900 mb-2 leading-tight">
                      {currentNews.title}
                    </h5>
                    <p className="text-slate-600 leading-relaxed">{currentNews.content}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Indicators */}
            <div className="flex justify-center space-x-2 mt-6">
              {newsItems.map((_, index) => (
                <button
                  key={`button-${index}`}
                  onClick={() => handleNewsChange(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentNewsIndex
                      ? 'bg-blue-500 scale-125 shadow-lg'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`View news item ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Stay updated with the latest AI trends</span>
              </div>
              <div className="text-xs text-slate-400">News updates every 4 seconds</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ModalWrapper>
  );
}

export const AINewsModal = memo(AINewsModalComponent);
AINewsModal.displayName = 'AINewsModal';
