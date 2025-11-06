import { supabase } from '@/lib/supabase';

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };

  const user = data.user;
  let nickname: string | undefined;
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .single();
    nickname = profileData?.nickname;
    if (nickname) localStorage.setItem('nickname', nickname);
  }

  return { user, nickname };
}

export async function signUpWithEmail(email: string, password: string, nickname?: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error };

  const user = data.user;
  if (user && nickname) {
    await supabase.from('profiles').upsert({ id: user.id, nickname });
    localStorage.setItem('nickname', nickname);
  }

  return { user, nickname };
}

export default { signInWithEmail, signUpWithEmail };
