
import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCircle, 
  ShieldCheck, 
  Mail, 
  MapPin, 
  Search, 
  Plus, 
  MoreVertical, 
  Building2, 
  Key, 
  Trash2, 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Filter,
  UserPlus,
  Lock,
  Settings,
  ShieldAlert,
  ChevronRight,
  X
} from 'lucide-react';
import { MOCK_USERS } from '../constants';
import { UserRole, User, Permission, RolePermission } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useUser } from '../UserContext';

const ALL_PERMISSIONS: Permission[] = [
  'MANAGE_FEES',
  'MANAGE_USERS',
  'APPROVE_CLAIMS',
  'VIEW_SETTLEMENT',
  'WRITE_MOVEMENTS',
  'VERIFY_RECEIPTS',
  'MANAGE_LOSSES',
  'VIEW_DASHBOARD',
  'VIEW_AUDIT_LOGS',
  'VIEW_REPORTS'
];

const UserManagement: React.FC = () => {
  const { profile, refreshProfile } = useUser();
  const isAdmin = profile?.role_name === UserRole.ADMIN;

  const [users, setUsers] = useState<User[]>(isSupabaseConfigured ? [] : MOCK_USERS);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All Roles');
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({
    id: '',
    name: '',
    email: '',
    role: UserRole.STAFF,
    branch_id: 'Kya Sands'
  });

  const fetchUsers = async () => {
    if (!isSupabaseConfigured) {
      setUsers(MOCK_USERS);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) throw error;
      
      if (data) {
        const mappedUsers: User[] = data.map((u: any) => ({
          id: u.id,
          name: u.full_name || 'Unknown',
          role: u.role_name as UserRole,
          branch_id: u.home_branch_name || 'Kya Sands'
        }));
        
        setUsers(mappedUsers);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      if (error) throw error;
      if (data) setRolePermissions(data);
    } catch (err: any) {
      console.error("Failed to fetch role permissions:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRolePermissions();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.branch_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'All Roles' || user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const handleResetPassword = async (userId: string) => {
    if (!isAdmin) return;
    
    try {
      // In a real scenario with Supabase Auth:
      // await supabase.auth.admin.resetPasswordForEmail(email);
      setNotification({ msg: `Password reset link dispatched for ${userId}`, type: 'success' });
    } catch (err: any) {
      setNotification({ msg: "Failed to reset password", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('users')
          .update({ role_name: newRole })
          .eq('id', userId);
        
        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (userId === profile?.id) {
        await refreshProfile();
      }
      setNotification({ msg: `Role updated successfully`, type: 'success' });
    } catch (err: any) {
      setNotification({ msg: "Failed to update role", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const payload: any = {
          id: newUser.id || crypto.randomUUID(),
          full_name: newUser.name,
          role_name: newUser.role,
          home_branch_name: newUser.branch_id
        };

        if (newUser.email) payload.email = newUser.email;

        const { error } = await supabase
          .from('users')
          .insert([payload]);
        
        if (error) {
          if (error.message.includes('column "email" of relation "users" does not exist')) {
            const { id, full_name, role_name, home_branch_name } = payload;
            const { error: retryError } = await supabase
              .from('users')
              .insert([{ id, full_name, role_name, home_branch_name }]);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }

      setUsers(prev => {
        const userId = newUser.id || 'new-id';
        if (prev.some(u => u.id === userId)) {
          return prev.map(u => u.id === userId ? { ...newUser, id: userId } : u);
        }
        return [...prev, { ...newUser, id: userId }];
      });
      setNotification({ msg: `Operator "${newUser.name}" added to registry`, type: 'success' });
      setIsAdding(false);
      setNewUser({ id: '', name: '', email: '', role: UserRole.STAFF, branch_id: 'Kya Sands' });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to add operator", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const togglePermission = async (roleName: string, permission: Permission) => {
    if (!isAdmin) return;
    
    const existing = rolePermissions.find(rp => rp.role_name === roleName && rp.permission === permission);
    
    try {
      if (existing) {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        setRolePermissions(prev => prev.filter(rp => rp.id !== existing.id));
      } else {
        const { data, error } = await supabase
          .from('role_permissions')
          .insert([{ role_name: roleName, permission }])
          .select()
          .single();
        if (error) throw error;
        if (data) setRolePermissions(prev => [...prev, data]);
      }
      setNotification({ msg: "Permissions updated", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: "Failed to update permissions", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Access Control</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage System Access & RBAC Permissions</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Users
            </button>
            <button 
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'permissions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Permissions
            </button>
          </div>
          <button 
            onClick={() => {
              fetchUsers();
              fetchRolePermissions();
            }}
            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
            title="Refresh List"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {activeTab === 'users' && (
            <button 
              disabled={!isAdmin}
              onClick={() => setIsAdding(true)}
              className="flex-1 lg:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
            >
              <UserPlus size={18} /> ADD OPERATOR
            </button>
          )}
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          {isAdding && (
            <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">New Operator Registration</h4>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">Close</button>
              </div>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator ID</label>
                  <input 
                    required
                    placeholder="e.g. U-005"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUser.id}
                    onChange={e => setNewUser({...newUser, id: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                  <input 
                    required
                    placeholder="e.g. Sipho Nkosi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    required
                    type="email"
                    placeholder="e.g. sipho@lupo.co.za"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Role</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  >
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Home Branch</label>
                  <input 
                    required
                    placeholder="e.g. Kya Sands"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUser.branch_id}
                    onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
                  />
                </div>
                <div className="lg:col-span-4 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
                  >
                    AUTHORIZE & REGISTER OPERATOR
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by name, ID or branch..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select 
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-slate-900"
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                  >
                    <option>All Roles</option>
                    {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                    <th className="px-8 py-5">System Operator</th>
                    <th className="px-8 py-5">Security Level</th>
                    <th className="px-8 py-5">Branch Assignment</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner font-black text-lg group-hover:bg-white transition-colors">
                             {user.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-sm font-black text-slate-900">{user.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">UID: {user.id}</p>
                             {(user as any).email && <p className="text-[10px] text-blue-500 font-medium">{ (user as any).email }</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {isAdmin ? (
                          <select 
                            value={user.role}
                            onChange={(e) => handleChangeRole(user.id, e.target.value as UserRole)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-none outline-none focus:ring-2 focus:ring-slate-900 transition-all cursor-pointer ${
                              user.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-700' :
                              user.role === UserRole.EXECUTIVE ? 'bg-indigo-100 text-indigo-700' :
                              user.role === UserRole.MANAGER ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                        ) : (
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                            user.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-700' :
                            user.role === UserRole.EXECUTIVE ? 'bg-indigo-100 text-indigo-700' :
                            user.role === UserRole.MANAGER ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Building2 size={14} className="text-slate-400" />
                            {user.branch_id}
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Authenticated</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right space-x-2">
                        <button 
                          onClick={() => handleResetPassword(user.id)}
                          disabled={!isAdmin}
                          title="Reset Password"
                          className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-30"
                        >
                          <Key size={18} />
                        </button>
                        <button 
                          disabled={!isAdmin}
                          title="Deactivate Account"
                          className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-30"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                            <Search size={32} />
                          </div>
                          <p className="text-sm font-bold text-slate-400">No operators found matching your criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.values(UserRole).map(role => (
            <div key={role} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">{role}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Role Permissions Matrix</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <Shield size={20} />
                </div>
              </div>
              <div className="p-8 space-y-3 flex-1">
                {ALL_PERMISSIONS.map(permission => {
                  const isAssigned = rolePermissions.some(rp => rp.role_name === role && rp.permission === permission);
                  return (
                    <button
                      key={permission}
                      disabled={!isAdmin || role === UserRole.ADMIN}
                      onClick={() => togglePermission(role, permission)}
                      className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        isAssigned 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                      } ${!isAdmin || role === UserRole.ADMIN ? 'cursor-default' : 'hover:border-emerald-200 active:scale-[0.98]'}`}
                    >
                      <div className="flex items-center gap-3">
                        {isAssigned ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{permission.replace(/_/g, ' ')}</span>
                      </div>
                      {role === UserRole.ADMIN && isAssigned && (
                        <Lock size={12} className="text-emerald-300" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center italic">
                  {role === UserRole.ADMIN ? 'Administrators have full system access by default' : 'Changes to this role affect all assigned operators immediately'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 flex items-center gap-4 shadow-2xl">
          <div className="p-3 bg-slate-800 rounded-2xl text-amber-500">
            <Lock size={24} />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-tight">Administrative Lock Active</p>
            <p className="text-xs text-slate-400 font-medium">Your current profile level allows viewing the registry, but role modifications and security resets require System Administrator clearance.</p>
          </div>
        </div>
      )}

      {/* Current User Permissions Display */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900 tracking-tight">Your Active Permissions</h4>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Based on your assigned role: {profile?.role_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.role_name === UserRole.ADMIN ? (
            <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={14} /> FULL SYSTEM ACCESS
            </div>
          ) : (
            rolePermissions
              .filter(rp => rp.role_name === profile?.role_name)
              .map(rp => (
                <div key={rp.id} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  {rp.permission.replace(/_/g, ' ')}
                </div>
              ))
          )}
          {profile?.role_name !== UserRole.ADMIN && rolePermissions.filter(rp => rp.role_name === profile?.role_name).length === 0 && (
            <p className="text-xs text-slate-400 font-bold italic">No specific permissions assigned to your role yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
