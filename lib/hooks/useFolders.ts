'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FolderItem = {
  id: string;
  folder_id: string;
  creative_id: string;
  note?: string | null;
  added_by?: string | null;
  created_at: string;
  position?: number | null;
};

type Folder = {
  id: string;
  owner: string;
  name: string;
  description?: string | null;
  is_public: boolean;
  created_at: string;
  updated_at?: string | null;
  folder_items?: FolderItem[];
};

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp: unknown = await supabase
        .from('folders')
        .select(
          `id, owner, name, description, is_public, created_at, updated_at, folder_items(id, folder_id, creative_id, added_by, created_at, position)`
        )
        .order('created_at', { ascending: false });

      // Normalize response/error so callers and UI get readable messages
      if (!resp) {
        const msg = 'No response from folders query';
        console.error(msg);
        throw new Error(msg);
      }

      const respObj = resp as Record<string, unknown>;
      const data = respObj.data as unknown;
      const error = respObj.error as unknown;
      if (error) {
        const msg =
          error && typeof error === 'object' && 'message' in (error as Record<string, unknown>)
            ? String((error as Record<string, unknown>).message)
            : String(error);
        console.error('Failed to fetch folders (supabase error)', error);
        throw new Error(msg);
      }

      setFolders((data || []) as Folder[]);
    } catch (e: unknown) {
      // Log full error for debugging and set a readable message
      const err = e;
      console.error('Failed to fetch folders', err);
      if (err instanceof Error) setError(err.message);
      else setError(typeof err === 'string' ? err : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
    // TODO: consider realtime subscriptions later
  }, [fetchFolders]);

  const createFolder = useCallback(
    async (name: string, description?: string, is_public = false) => {
      try {
        // supabase.auth.getUser may have different shapes across versions; be defensive
        let owner: string | null = null;
        try {
          const userRes = (await supabase.auth.getUser()) as unknown;
          let ownerId: string | null = null;
          if (userRes && typeof userRes === 'object') {
            const data = (userRes as Record<string, unknown>)['data'];
            if (data && typeof data === 'object') {
              const userObj = (data as Record<string, unknown>)['user'];
              if (userObj && typeof userObj === 'object') {
                const id = (userObj as Record<string, unknown>)['id'];
                if (typeof id === 'string') ownerId = id;
              }
            }
          }
          owner = ownerId;
        } catch (e: unknown) {
          // If fetching the user fails, continue with null owner but surface a warning
          console.warn(
            'Could not determine current user for folder owner; continuing with null owner',
            e
          );
          owner = null;
        }
        const payload = { owner, name, description, is_public } as Record<string, unknown>;
        const insertResp = (await supabase.from('folders').insert([payload]).select()) as unknown;
        if (!insertResp) throw new Error('No response from insert');
        const insertObj = insertResp as Record<string, unknown>;
        const insertError = insertObj.error as unknown;
        const insertData = insertObj.data as unknown;
        if (insertError) {
          const errMsg =
            insertError &&
            typeof insertError === 'object' &&
            'message' in (insertError as Record<string, unknown>)
              ? String((insertError as Record<string, unknown>).message)
              : String(insertError);
          throw new Error(errMsg);
        }

        const row = Array.isArray(insertData) ? (insertData as unknown[])[0] : insertData;
        await fetchFolders();
        return row as Folder;
      } catch (e: unknown) {
        const err = e;
        console.error('Create folder failed', err);
        const message =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        throw new Error(message);
      }
    },
    [fetchFolders]
  );

  const updateFolder = useCallback(
    async (
      id: string,
      updates: { name?: string; description?: string; is_public?: boolean; owner?: string }
    ) => {
      try {
        // If owner is being changed, call the server-side transfer endpoint
        if (updates.owner) {
          try {
            const session = (await supabase.auth.getSession()).data.session;
            const token = session?.access_token;
            if (!token) throw new Error('No access token available for transfer');

            const res = await fetch(`/api/folders/transfer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ folderId: id, newOwnerId: updates.owner }),
            });

            const json = await res.json();
            if (!res.ok) {
              const msg = json?.error || `transfer failed with status ${res.status}`;
              throw new Error(msg);
            }

            await fetchFolders();
            return json.folder as Folder;
          } catch (e: unknown) {
            console.error('Transfer to new owner failed', e);
            throw e;
          }
        }

        const { data, error } = await supabase
          .from('folders')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        await fetchFolders();
        return data as Folder;
      } catch (e: unknown) {
        console.error('Update folder failed', e);
        throw e;
      }
    },
    [fetchFolders]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (error) throw error;
        await fetchFolders();
        return true;
      } catch (e: unknown) {
        console.error('Delete folder failed', e);
        throw e;
      }
    },
    [fetchFolders]
  );

  const addItemToFolder = useCallback(
    async (folderId: string, creativeId: string, note?: string) => {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        const added_by = user?.id || null;
        const { data, error } = await supabase
          .from('folder_items')
          .insert([{ folder_id: folderId, creative_id: creativeId, note, added_by }])
          .select()
          .single();
        if (error) throw error;
        await fetchFolders();
        return data as FolderItem;
      } catch (e: unknown) {
        console.error('Add item to folder failed', e);
        throw e;
      }
    },
    [fetchFolders]
  );

  const removeItemFromFolder = useCallback(
    async (folderId: string, creativeId?: string, itemId?: string) => {
      try {
        let query = supabase.from('folder_items').delete();
        if (itemId) query = query.eq('id', itemId);
        else if (creativeId) query = query.match({ folder_id: folderId, creative_id: creativeId });
        else throw new Error('provide itemId or creativeId');
        const { error } = await query;
        if (error) throw error;
        await fetchFolders();
        return true;
      } catch (e: unknown) {
        console.error('Remove item from folder failed', e);
        throw e;
      }
    },
    [fetchFolders]
  );

  const setItemNote = useCallback(
    async (itemId: string, note?: string) => {
      try {
        const { data, error } = await supabase
          .from('folder_items')
          .update({ note })
          .eq('id', itemId)
          .select()
          .single();
        if (error) throw error;
        await fetchFolders();
        return data as FolderItem;
      } catch (e: unknown) {
        console.error('Set item note failed', e);
        throw e;
      }
    },
    [fetchFolders]
  );

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    addItemToFolder,
    removeItemFromFolder,
    setItemNote,
  };
}

export type { Folder, FolderItem };
