'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { X, Plus, Heart } from 'lucide-react';
import { supabase } from '@/lib/core/supabase';
import dynamic from 'next/dynamic';
const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});
import ModalWrapper from '../../../components/modals/ModalWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFolders } from '@/lib/hooks/useFolders';
import { useFavorites } from '@/lib/hooks/useFavorites';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  creativeId: string;
}

export default function PlaylistModal({ isOpen, onClose, creativeId }: PlaylistModalProps) {
  const { folders, createFolder, addItemToFolder, removeItemFromFolder } = useFolders();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [newName, setNewName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const favState = isFavorite(creativeId);

  const handleFavoriteToggle = useCallback(() => {
    try {
      toggleFavorite(creativeId);
      setToast(isFavorite(creativeId) ? 'Removed from favorites' : 'Added to favorites');
      setTimeout(() => setToast(null), 1800);
    } catch (e) {
      console.error('favorite toggle failed', e);
    }
  }, [toggleFavorite, creativeId]);

  const membership = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const f of folders) {
      const has = (f.folder_items || []).some(
        (it) => it.creative_id === creativeId || it.creative_id === creativeId.toString()
      );
      map[f.id] = has;
    }
    return map;
  }, [folders, creativeId]);

  const handleToggle = useCallback(
    async (folderId: string) => {
      try {
        if (isAuthenticated === false) {
          setShowLogin(true);
          return;
        }
        if (membership[folderId]) {
          await removeItemFromFolder(folderId, creativeId);
          setToast('Removed from folder');
          setTimeout(() => setToast(null), 1800);
        } else {
          await addItemToFolder(folderId, creativeId);
          setToast('Added to folder');
          setTimeout(() => setToast(null), 1800);
        }
      } catch (e) {
        console.error('Folder add/remove failed', e);
      }
    },
    [membership, addItemToFolder, removeItemFromFolder, creativeId, isAuthenticated]
  );

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      if (isAuthenticated === false) {
        setShowLogin(true);
        return;
      }
      const created = await createFolder(name);
      if (created?.id) await addItemToFolder(created.id, creativeId);
      setNewName('');
      setToast('Folder created and item added');
      setTimeout(() => setToast(null), 1800);
    } catch (e) {
      console.error('Create folder failed', e);
    }
  }, [newName, createFolder, addItemToFolder, creativeId, isAuthenticated]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await supabase.auth.getUser();
        if (!mounted) return;
        const user = res?.data?.user;
        setIsAuthenticated(!!user);
      } catch (e) {
        if (!mounted) return;
        setIsAuthenticated(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isOpen) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} panelClassName="p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold">Add to playlist</h3>
              <p className="text-sm text-slate-500">
                Add this ad to favorites or to one of your folders.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-600">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-600 mb-1 block">Favorites</div>
                <p className="text-xs text-slate-500">Saved locally in your browser</p>
              </div>
              <Button
                onClick={handleFavoriteToggle}
                variant="ghost"
                className={`flex items-center gap-2 ${
                  favState ? 'text-red-600' : 'text-slate-700'
                }`}
              >
                <Heart className="h-4 w-4" />
                <span className="text-sm">{favState ? 'Remove' : 'Add'}</span>
              </Button>
            </div>

            <div>
              <label htmlFor="new-folder-name" className="text-sm text-slate-600 mb-2 block">
                Create new folder
              </label>
              <div className="flex gap-2">
                <Input
                  id="new-folder-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Folder name"
                />
                <Button onClick={handleCreate} className="px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600 mb-2 block">Your folders</div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {folders.length === 0 && (
                  <div className="text-sm text-slate-500">No folders yet</div>
                )}
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-slate-50 p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id={`folder-${f.id}`}
                        type="checkbox"
                        checked={!!membership[f.id]}
                        onChange={() => handleToggle(f.id)}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-500">
                          {(f.folder_items || []).length} items
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* inline toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      {/* login modal for folder actions */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </ModalWrapper>
  );
}

export { PlaylistModal };
