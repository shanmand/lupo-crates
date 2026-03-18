
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { UserRole, User } from './types';

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
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
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
        setProfile({
          id: userId,
          full_name: "Guest User",
          role_name: UserRole.STAFF,
          home_branch_name: 'Kya Sands',
          email: user?.email || ''
        });
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
    } catch (err) {
      console.error("Profile Fetch Error (User likely not in DB yet):", err);
      setProfile({
        id: userId,
        full_name: "Guest User",
        role_name: UserRole.STAFF,
        home_branch_name: 'Kya Sands',
        email: user?.email || ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fix: Using type casting to bypass property missing errors on SupabaseAuthClient in specific environments
    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
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

    const role = profile.role_name;
    if (role === UserRole.EXECUTIVE) {
      return ['VIEW_DASHBOARD', 'VIEW_SETTLEMENT'].includes(permission);
    }
    if (role === UserRole.STAFF) {
      return ['WRITE_MOVEMENTS', 'MANAGE_LOSSES', 'VIEW_DASHBOARD'].includes(permission);
    }
    return true;
  };

  return (
    <UserContext.Provider value={{ user, profile, isLoading, logout, refreshProfile, hasPermission }}>
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
