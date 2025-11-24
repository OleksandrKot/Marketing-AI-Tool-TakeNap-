'use client';

import type React from 'react';

import { useState, useCallback } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Ad } from '@/lib/core/types';

interface TagManagerProps {
  ad: Ad;
  onTagsUpdate?: (tags: string[]) => void;
}

export function TagManager({ ad, onTagsUpdate }: TagManagerProps) {
  const [tags, setTags] = useState<string[]>(ad.tags || []);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = useCallback(async () => {
    const trimmedTag = newTag.trim().toLowerCase();

    if (!trimmedTag || tags.includes(trimmedTag)) {
      setNewTag('');
      setIsAddingTag(false);
      return;
    }

    setIsLoading(true);

    try {
      // Тут буде API запит для збереження тегів в базу даних
      // Поки що просто оновлюємо локальний стан
      const updatedTags = [...tags, trimmedTag];
      setTags(updatedTags);
      setNewTag('');
      setIsAddingTag(false);

      // Викликаємо callback якщо він переданий
      onTagsUpdate?.(updatedTags);

      // Симулюємо API запит
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setIsLoading(false);
    }
  }, [newTag, tags, onTagsUpdate]);

  const handleRemoveTag = useCallback(
    async (tagToRemove: string) => {
      setIsLoading(true);

      try {
        // Тут буде API запит для видалення тегу з бази даних
        const updatedTags = tags.filter((tag) => tag !== tagToRemove);
        setTags(updatedTags);

        // Викликаємо callback якщо він переданий
        onTagsUpdate?.(updatedTags);

        // Симулюємо API запит
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Error removing tag:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [tags, onTagsUpdate]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Escape') {
        setNewTag('');
        setIsAddingTag(false);
      }
    },
    [handleAddTag]
  );

  return (
    <div className="flex items-center space-x-2">
      {/* Existing Tags */}
      {tags.length > 0 && (
        <div className="flex items-center space-x-1">
          {tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-1 rounded-full border text-xs"
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                disabled={isLoading}
                className="ml-1 text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium px-2 py-1 rounded-full border text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Add Tag Input */}
      {isAddingTag ? (
        <div className="flex items-center space-x-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Add tag..."
            className="h-8 w-24 text-xs border-blue-200 focus:border-blue-500"
            maxLength={20}
            aria-label="New tag"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddTag}
            disabled={!newTag.trim() || isLoading}
            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
            aria-label={isLoading ? 'Adding tag' : 'Add tag'}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-white"></div>
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNewTag('');
              setIsAddingTag(false);
            }}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
            aria-label="Cancel adding tag"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsAddingTag(true)}
          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Add tag"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      {/* All Tags Modal Trigger (if more than 2 tags) */}
      {tags.length > 2 && (
        <Card className="absolute top-full left-0 mt-2 w-64 z-50 shadow-lg hidden group-hover:block">
          <CardContent className="p-3">
            <h4 className="text-sm font-medium text-slate-700 mb-2">All Tags:</h4>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-1 rounded-full border text-xs"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={isLoading}
                    className="ml-1 text-blue-500 hover:text-blue-700 disabled:opacity-50"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
