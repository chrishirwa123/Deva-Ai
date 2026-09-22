import { supabase } from './supabase';
import type { AppSettings, OwnerProfile } from './types';

export async function getSettings(): Promise<AppSettings | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as AppSettings | null;
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings | null> {
  const { data } = await supabase
    .from('app_settings')
    .update(updates)
    .eq('id', 1)
    .select('*')
    .maybeSingle();
  return data as AppSettings | null;
}

export async function getOwnerProfile(): Promise<OwnerProfile | null> {
  const { data } = await supabase
    .from('owner_profile')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as OwnerProfile | null;
}

export async function updateOwnerProfile(updates: Partial<OwnerProfile>): Promise<OwnerProfile | null> {
  const { data } = await supabase
    .from('owner_profile')
    .update(updates)
    .eq('id', 1)
    .select('*')
    .maybeSingle();
  return data as OwnerProfile | null;
}
