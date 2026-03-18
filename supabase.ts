
import { createClient } from '@supabase/supabase-js';
import { User, UserRole } from './types';

/**
 * DEPLOYMENT NOTE:
 * Replace these values with your actual Supabase Project URL and Anon Key
 * found in Settings -> API of your Supabase dashboard.
 */
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || (process.env as any).SUPABASE_URL || 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (process.env as any).SUPABASE_ANON_KEY || 'your-live-anon-key';

console.log('Supabase Config:', { 
  url: SUPABASE_URL, 
  hasKey: !!SUPABASE_ANON_KEY,
  isPlaceholderUrl: SUPABASE_URL === 'https://your-project-id.supabase.co',
  isPlaceholderKey: SUPABASE_ANON_KEY === 'your-live-anon-key'
});

export const isSupabaseConfigured = 
  SUPABASE_URL && 
  SUPABASE_URL !== 'https://your-project-id.supabase.co' && 
  SUPABASE_ANON_KEY &&
  SUPABASE_ANON_KEY !== 'your-live-anon-key';

console.log('isSupabaseConfigured:', isSupabaseConfigured);

/**
 * Single Supabase Instance
 * This singleton is used for all DB and Auth interactions.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Storage Helpers
 */
export const uploadFleetDocument = async (
  file: File,
  branchId: string,
  entityId: string,
  fileName: string
) => {
  const fileExt = file.name.split('.').pop();
  // Sanitize path: remove spaces and special characters from branchId, entityId, and fileName
  const cleanBranchId = branchId.replace(/[^a-z0-9]/gi, '_');
  const cleanEntityId = entityId.replace(/[^a-z0-9]/gi, '_');
  const cleanFileName = fileName.replace(/[^a-z0-9]/gi, '_');
  
  const filePath = `${cleanBranchId}/${cleanEntityId}/${cleanFileName}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('fleet-documents')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) throw error;
  return data.path;
};

export const getSignedFleetDocumentUrl = async (path: string) => {
  const { data, error } = await supabase.storage
    .from('fleet-documents')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
};

/**
 * Helper to map Supabase User metadata to our application's User type.
 */
export const mapSupabaseUser = (supabaseUser: any): User | null => {
  if (!supabaseUser) return null;

  const metadata = supabaseUser.user_metadata || {};
  
  return {
    id: supabaseUser.id,
    name: metadata.full_name || supabaseUser.email?.split('@')[0] || 'Unknown User',
    role: (metadata.role as UserRole) || UserRole.STAFF,
    branch_id: metadata.branch_id || 'LOC-JHB-01'
  };
};
