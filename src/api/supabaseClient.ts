import { createClient } from '@supabase/supabase-js';

// Basic Supabase client for anonymous, public usage
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ovvaqagkqxljpkwdynoa.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dmFxYWdrcXhsanBrd2R5bm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMTAwNDgsImV4cCI6MjA3MTY4NjA0OH0.qqQ_afjZ-Dh8_Zrf9eyCJnryDw6S7x95ZZXikBTbwo0'
);

export type KvKey = 'workSettings' | 'workDays';

// 允许基于“同步空间码”进行分区（无登录）。当传入 spaceId 时，读写以 spaceId 为主键之一
export type SpaceContext = { spaceId?: string | null };

export async function ensureAuth(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  // 匿名登录（每端生成一个匿名用户，实现按用户隔离）
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase anonymous sign-in failed:', error.message);
    return null;
  }
  return signIn?.user?.id ?? null;
}

export async function fetchKv<T = unknown>(key: KvKey, ctx?: SpaceContext): Promise<T | null> {
  const uid = ctx?.spaceId || (await ensureAuth()) || (await supabase.auth.getUser()).data.user?.id || null;
  const query = supabase
    .from('kv_store')
    .select('value')
    .eq('key', key);
  const { data, error } = uid ? await query.eq('user_id', uid).maybeSingle() : await query.maybeSingle();
  if (error) {
    console.warn('Supabase fetchKv error:', error.message);
    return null;
  }
  return (data?.value as T) ?? null;
}

export async function upsertKv<T = unknown>(key: KvKey, value: T, ctx?: SpaceContext): Promise<void> {
  // user_id 由客户端提交，RLS 校验必须等于 auth.uid()
  const userId = ctx?.spaceId || (await supabase.auth.getUser()).data.user?.id;
  // 避免把空间码写回云端
  const sanitized = (() => {
    if (key !== 'workSettings' || value == null || typeof value !== 'object') return value;
    const v = { ...(value as any) };
    delete (v as any).syncSpace;
    return v as T;
  })();
  // 云端保持与本地一致：workDays 完整数组直存
  const payload: Record<string, unknown> = { key, value: sanitized };
  if (userId) payload.user_id = userId;
  const { error } = await supabase
    .from('kv_store')
    .upsert(payload, { onConflict: 'user_id,key' });
  if (error) {
    console.warn('Supabase upsertKv error:', error.message);
  }
}

// 单对象快照：把 workSettings 与 workDays 放在一个 JSON 中，减少读写次数
export type Snapshot = { workSettings: any; workDays: any };

export async function fetchSnapshot(ctx?: SpaceContext): Promise<Snapshot | null> {
  const uid = ctx?.spaceId || (await supabase.auth.getUser()).data.user?.id || null;
  const query = supabase.from('kv_store').select('value').eq('key', 'snapshot');
  const { data, error } = uid ? await query.eq('user_id', uid).maybeSingle() : await query.maybeSingle();
  if (error) {
    console.warn('Supabase fetchSnapshot error:', error.message);
    return null;
  }
  return (data?.value as Snapshot) ?? null;
}

export async function upsertSnapshot(snapshot: Snapshot, ctx?: SpaceContext): Promise<void> {
  const userId = ctx?.spaceId || (await supabase.auth.getUser()).data.user?.id;
  const sanitized = { ...snapshot, workSettings: { ...snapshot.workSettings } } as Snapshot;
  delete (sanitized.workSettings as any).syncSpace; // 不把空间码写回云端
  const payload: Record<string, unknown> = { key: 'snapshot', value: sanitized };
  if (userId) payload.user_id = userId;
  const { error } = await supabase
    .from('kv_store')
    .upsert(payload, { onConflict: 'user_id,key' });
  if (error) {
    console.warn('Supabase upsertSnapshot error:', error.message);
  }
}

// 删除整个空间的数据（workSettings 与 workDays）
export async function deleteSpace(spaceId: string): Promise<void> {
  if (!spaceId) return;
  const { error } = await supabase
    .from('kv_store')
    .delete()
    .eq('user_id', spaceId);
  if (error) {
    console.warn('Supabase deleteSpace error:', error.message);
  }
}


