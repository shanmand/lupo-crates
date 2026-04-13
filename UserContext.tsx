
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { UserRole, User, RolePermission } from './types';

interface UserProfile {
  id: string;
  full_name: string;
  role_name: UserRole;
  home_branch_name: string;
  email?: string;
}

interface UserContextType {
  user: any;
  profile: UserProfile | null;
  permissions: string[];
  isLoading: boolean;
  isSchemaIncomplete: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchemaIncomplete, setIsSchemaIncomplete] = useState(false);

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  const fetchPermissions = async (roleName: string) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission')
        .eq('role_name', roleName);
      
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          setIsSchemaIncomplete(true);
        }
        throw error;
      }
      if (data) {
        setPermissions(data.map((p: any) => p.permission));
      }
    } catch (err: any) {
      console.error("Error fetching permissions:", err);
      if (err.code === 'PGRST205' || err.message?.includes('Could not find the table')) {
        setIsSchemaIncomplete(true);
      }
      setPermissions([]);
    }
  };

  const fetchProfile = async (userId: string) => {
    console.log('UserContext: Fetching profile for:', userId);
    try {
      let data: any;
      let error: any;

      const firstTry = await supabase
        .from('users')
        .select(`id, full_name, email, home_branch_name, role_name`)
        .eq('id', userId)
        .single();
      
      data = firstTry.data;
      error = firstTry.error;

      if (error) {
        console.warn("UserContext: Profile Fetch Error (User likely not in DB yet):", error);
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          setIsSchemaIncomplete(true);
        }
        setProfile(null);
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      console.log('UserContext: Profile received:', data);
      const profileData: UserProfile = {
        id: data.id,
        full_name: data.full_name || 'Unnamed User',
        role_name: data.role_name as UserRole || UserRole.STAFF,
        home_branch_name: data.home_branch_name || 'Kya Sands',
        email: data.email || user?.email || '',
      };

      setProfile(profileData);
      await fetchPermissions(profileData.role_name);
    } catch (err) {
      console.error("Profile Fetch Error (User likely not in DB yet):", err);
      setProfile(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    (supabase.auth as any).getSession().then(({ data: { session }, error }: any) => {
      if (error) {
        console.error('UserContext: Session Error:', error);
        // If the refresh token is invalid or not found, clear the session
        if (error.message?.includes('Refresh Token Not Found') || error.message?.includes('invalid_grant')) {
          (supabase.auth as any).signOut();
        }
        setUser(null);
        setIsLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: any, session: any) => {
      console.log('UserContext: Auth State Change Event:', event, session?.user?.id);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setPermissions([]);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    await (supabase.auth as any).signOut();
  };

  const hasPermission = (permission: string): boolean => {
    if (!profile) return false;
    // Admin has all permissions
    if (profile.role_name === UserRole.ADMIN) return true;

    return permissions.includes(permission);
  };

  return (
    <UserContext.Provider value={{ user, profile, permissions, isLoading, isSchemaIncomplete, logout, refreshProfile, hasPermission }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
