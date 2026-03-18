
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { Branch } from './types';

export const useBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      console.log('useBranches: Fetching branches... Configured:', isSupabaseConfigured);
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
          console.error('useBranches: Error fetching branches:', error);
          throw error;
        }
        console.log('useBranches: Branches received:', data?.length);
        if (data) setBranches(data);
      } catch (err: any) {
        console.error('useBranches: Error fetching branches:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, []);

  return { branches, isLoading, error };
};
