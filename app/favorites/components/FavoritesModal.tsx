'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useToast } from '@/components/ui/toast';
import { useFolders } from '@/lib/hooks/useFolders';
import ModalWrapper from '@/components/modals/ModalWrapper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  creativeId: string;
}

export default function FavoritesModal({ isOpen, onClose, creativeId }: Props) {
  const {
    collections,
    createCollection,
    addToCollection,
    removeFromCollection,
    isFavorite,
    addFavorite,
    removeFavorite,
  } = useFavorites();
  const { folders, createFolder, addItemToFolder, removeItemFromFolder } = useFolders();
  const { showToast } = useToast();
  const [newFolderName, setNewFolderName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewFolderName('');
      setNewCollectionName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isInCollection = (id: string) =>
    collections.some((c) => c.id === id && c.itemIds.includes(creativeId));
  const isInFolder = (id: string) =>
    (folders.find((f) => f.id === id)?.folder_items || []).some(
      (it) => it.creative_id === creativeId
    );

  const favoriteState = isFavorite(creativeId);

  const toggleCollection = useCallback(
    (colId: string) => {
      try {
        if (isInCollection(colId)) removeFromCollection(colId, creativeId);
        else addToCollection(colId, creativeId);
      } catch (e) {
        console.error(e);
        showToast?.({ message: `Failed to update collection: ${String(e)}`, type: 'error' });
      }
    },
    [collections, addToCollection, removeFromCollection, creativeId]
  );

  const toggleFolder = useCallback(
    async (folderId: string) => {
      try {
        if (isInFolder(folderId)) await removeItemFromFolder(folderId, creativeId);
        else await addItemToFolder(folderId, creativeId);
        showToast?.({
          message: isInFolder(folderId) ? 'Removed from folder' : 'Added to folder',
          type: 'success',
        });
      } catch (e) {
        console.error(e);
        showToast?.({ message: `Folder update failed: ${String(e)}`, type: 'error' });
      }
    },
    [folders, addItemToFolder, removeItemFromFolder, creativeId]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const created = await createFolder(name);
      if (created?.id) await addItemToFolder(created.id, creativeId);
      setNewFolderName('');
      showToast?.({ message: `Folder "${name}" created and item added`, type: 'success' });
    } catch (e) {
      console.error(e);
      showToast?.({ message: `Failed to create folder: ${String(e)}`, type: 'error' });
    }
  }, [newFolderName, createFolder, addItemToFolder, creativeId]);

  const handleCreateCollection = useCallback(() => {
    const name = newCollectionName.trim();
    if (!name) return;
    createCollection(name);
    setTimeout(() => {
      const created = collections.find((c) => c.name === name);
      if (created) addToCollection(created.id, creativeId);
      showToast?.({ message: `Collection "${name}" created and item added`, type: 'success' });
    }, 120);
    setNewCollectionName('');
  }, [newCollectionName, createCollection, collections, addToCollection, creativeId]);

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} panelClassName="p-4">
      <Card className="w-full max-w-2xl shadow-lg transform transition-all duration-150 scale-100">
        <CardContent className="p-6">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-50 p-2">
                <svg
                  className="w-6 h-6 text-red-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 21s-7.5-4.35-10.5-7.02C-0.46 9.95 2 5 6 5c2.21 0 3.5 1.64 4 2.5.5-.86 1.79-2.5 4-2.5 4 0 6.46 4.95 4.5 8.98C19.5 16.65 12 21 12 21z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Save to...</h3>
                <p className="text-sm text-slate-500">
                  Choose a folder or collection to save this ad. You can create new ones here.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  try {
                    if (favoriteState) {
                      removeFavorite(creativeId);
                      showToast?.({ message: 'Removed from favorites', type: 'success' });
                    } else {
                      addFavorite(creativeId);
                      showToast?.({ message: 'Added to favorites', type: 'success' });
                    }
                  } catch (e) {
                    console.error(e);
                    showToast?.({ message: `Favorite action failed: ${String(e)}`, type: 'error' });
                  }
                }}
                className={`flex items-center gap-2 ${
                  favoriteState ? 'text-red-600' : 'text-slate-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={favoriteState ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 21s-7.5-4.35-10.5-7.02C-0.46 9.95 2 5 6 5c2.21 0 3.5 1.64 4 2.5.5-.86 1.79-2.5 4-2.5 4 0 6.46 4.95 4.5 8.98C19.5 16.65 12 21 12 21z" />
                </svg>
                <span className="text-sm">{favoriteState ? 'Favorited' : 'Add to favorites'}</span>
              </Button>

              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-2">Folders</h4>
              <div className="space-y-2 max-h-48 overflow-auto mb-3">
                {folders.length === 0 && (
                  <div className="text-sm text-slate-500">No folders yet</div>
                )}
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isInFolder(f.id)}
                        onChange={() => toggleFolder(f.id)}
                      />
                      <div>
                        <div className="font-medium text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-500">
                          {(f.folder_items || []).length} items
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                />
                <Button onClick={handleCreateFolder} className="px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Collections (local)</h4>
              <div className="space-y-2 max-h-48 overflow-auto mb-3">
                {collections.length === 0 && (
                  <div className="text-sm text-slate-500">No collections yet</div>
                )}
                {collections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isInCollection(c.id)}
                        onChange={() => toggleCollection(c.id)}
                      />
                      <div>
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.itemIds.length} items</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name"
                />
                <Button onClick={handleCreateCollection} className="px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ModalWrapper>
  );
}
