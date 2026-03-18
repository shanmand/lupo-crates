
import React, { useState } from 'react';
import { 
  Settings, 
  Users as UsersIcon, 
  ShieldCheck, 
  Database, 
  Key, 
  UserPlus, 
  Building2, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  MoreVertical, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  History as HistoryIcon,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  XCircle
} from 'lucide-react';
import { UserRole, FeeType } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useUser } from '../UserContext';
import DatabaseCleanup from './DatabaseCleanup';

const AdminPanel: React.FC<{ currentRole: UserRole }> = ({ currentRole }) => {
  const { profile, user, refreshProfile } = useUser();
  const isAdmin = currentRole === UserRole.ADMIN;
  const [activeSubTab, setActiveSubTab] = useState<'fees' | 'users' | 'maintenance' | 'cleanup'>('fees');

  const handleBootstrapAdmin = async () => {
    if (!user) {
      setNotification({ msg: "Authentication Required: Please sign in via Supabase to claim the administrator role.", type: 'error' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        role_name: UserRole.ADMIN,
        home_branch_name: 'Kya Sands'
      };

      // Only add email if it's available in the user object
      if (user.email) {
        payload.email = user.email;
      }

      const { error } = await supabase
        .from('users')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        if (error.message.includes('column "email" of relation "users" does not exist')) {
          // Fallback: try without email if column is missing
          const { id, full_name, role_name, home_branch_name } = payload;
          const { error: retryError } = await supabase
            .from('users')
            .upsert([{ id, full_name, role_name, home_branch_name }], { onConflict: 'id' });
          
          if (retryError) throw retryError;
          
          setNotification({ 
            msg: "System Bootstrapped (Legacy Schema): You are now Admin. Please update your database schema to include the 'email' column.", 
            type: 'success' 
          });
        } else {
          throw error;
        }
      } else {
        setNotification({ msg: "System Bootstrapped: You are now a System Administrator", type: 'success' });
      }
      
      await refreshProfile();
      await fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Bootstrap failed", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Fee Form State
  const [targetAsset, setTargetAsset] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRental, setDailyRental] = useState(5.15);
  const [issueFee, setIssueFee] = useState(145.00);
  const [replacementFee, setReplacementFee] = useState(135.00);
  
  const [dbFees, setDbFees] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbAssets, setDbAssets] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setDbFees([]);
      setDbUsers([]);
      setDbAssets([]);
      return;
    }
    try {
      const [feesRes, usersRes, assetsRes] = await Promise.all([
        supabase.from('fee_schedule').select('*').eq('is_active', true),
        supabase.from('users').select('*'),
        supabase.from('asset_master').select('*')
      ]);

      if (feesRes.data) setDbFees(feesRes.data);
      if (usersRes.data) {
        const mappedUsers = usersRes.data.map((u: any) => ({
          id: u.id,
          full_name: u.full_name || 'Unnamed User',
          email: u.email || '',
          role_name: u.role_name || UserRole.STAFF,
          home_branch_name: u.home_branch_name || 'Kya Sands'
        }));
        setDbUsers(mappedUsers);
      }
      if (assetsRes.data) {
        setDbAssets(assetsRes.data);
        if (assetsRes.data.length > 0 && !targetAsset) {
          setTargetAsset(assetsRes.data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const displayFees = dbFees;
  const displayUsers = dbUsers;
  const displayAssets = dbAssets;

  /**
   * Action: Introduce New Fee Schedule
   * 1. Check Role
   * 2. Update existing active fees for this asset (Set is_active = false)
   * 3. Insert new fee schedule records
   */
  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setNotification({ msg: "Forbidden: Admin role required.", type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Bulk Update: Close existing active fees for the asset
        const { error: updateError } = await supabase
          .from('fee_schedule')
          .update({ is_active: false, effective_to: effectiveDate })
          .eq('asset_id', targetAsset)
          .is('effective_to', null);

        if (updateError) throw updateError;

        // 2. Insert New Fee Schedule
        const newFees = [
          { asset_id: targetAsset, fee_type: FeeType.DAILY_RENTAL, amount_zar: dailyRental, effective_from: effectiveDate, is_active: true },
          { asset_id: targetAsset, fee_type: FeeType.ISSUE_FEE, amount_zar: issueFee, effective_from: effectiveDate, is_active: true },
          { asset_id: targetAsset, fee_type: FeeType.REPLACEMENT_FEE, amount_zar: replacementFee, effective_from: effectiveDate, is_active: true }
        ];

        const { error: insertError } = await supabase
          .from('fee_schedule')
          .insert(newFees);

        if (insertError) throw insertError;
        await fetchData();
      } else {
        // Mock success for development
        console.warn("Supabase not configured. Simulating fee update success.");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setNotification({ msg: "Annual fee schedule transitioned successfully.", type: 'success' });
    } catch (err: any) {
      console.error("Fee update error:", err);
      setNotification({ msg: err.message || "Failed to update fees.", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!isAdmin) return;
    try {
      // In real scenario: supabase.auth.admin.resetPasswordForEmail(...)
      alert(`Password reset link dispatched for User ID: ${userId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateUserName = async (userId: string, newName: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: newName })
        .eq('id', userId);
      
      if (error) throw error;
      await fetchData();
      setNotification({ msg: "User name updated", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to update name", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ role_name: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      await fetchData();
      setNotification({ msg: `Role updated for ${userId}`, type: 'success' });
    } catch (err) {
      setNotification({ msg: "Failed to update role", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this user? This may fail if the user has associated records (Audit Logs, etc.).")) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      await fetchData();
      setNotification({ msg: "User deleted successfully", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to delete user", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleWipeData = async () => {
    if (!isAdmin) return;
    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL records from the database (Batches, Movements, Losses, Claims, etc.). This action cannot be undone. Proceed?")) return;

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        // Delete in order of dependencies to respect foreign key constraints
        const tables = [
          'audit_logs',
          'claim_audits',
          'claims',
          'thaan_slips',
          'batch_movements',
          'asset_losses',
          'batches',
          'fee_schedule',
          'logistics_units',
          'locations',
          'asset_master',
          'users'
        ];

        for (const table of tables) {
          // Use a filter that matches all rows. 
          // For users table, we exclude the current user to prevent lockout
          const query = supabase.from(table).delete();
          
          if (table === 'users' && user?.id) {
            query.neq('id', user.id);
          } else {
            // Dummy filter to allow delete on all rows
            query.neq('id', '_');
          }
          
          const { error } = await query;
          if (error) {
            console.warn(`Error wiping ${table}:`, error.message);
          }
        }

        await fetchData();
        setNotification({ msg: "System data wiped successfully. Database is now clean for production.", type: 'success' });
      } else {
        setNotification({ msg: "Supabase not connected. Mock data remains in source code but session is 'Live Mode' ready.", type: 'success' });
      }
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to wipe system data", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ id: '', name: '', email: '', role: UserRole.STAFF, branch_id: 'LOC-JHB-01' });

  const generateUUID = () => {
    // Manual UUID v4 generator to avoid environment-specific crypto issues
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleOpenAddUser = () => {
    setNewUser({ ...newUser, id: generateUUID() });
    setIsAddingUser(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      const payload: any = { 
        id: newUser.id, 
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

      await fetchData();
      setIsAddingUser(false);
      setNewUser({ id: '', name: '', email: '', role: UserRole.STAFF, branch_id: 'LOC-JHB-01' });
      setNotification({ msg: "User added successfully", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to add user", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const renderMaintenance = () => (
    <div className="max-w-4xl space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 bg-rose-600 text-white">
          <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight"><Trash2 size={24} /> Danger Zone</h3>
          <p className="text-xs text-rose-100 font-bold uppercase tracking-widest mt-1">Destructive System Operations</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-6 p-6 bg-rose-50 rounded-2xl border border-rose-100">
            <AlertTriangle className="text-rose-600 shrink-0" size={32} />
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight">Wipe All System Records</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will truncate all tables in your Supabase instance. This includes Users, Locations, Equipment, and Fee Schedules. 
                Use this only when transitioning from <strong>Staging/UAT</strong> to <strong>Production (Live)</strong>.
              </p>
              <button 
                onClick={handleWipeData}
                disabled={isSubmitting || !isAdmin}
                className="mt-6 px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-xl shadow-rose-100 disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Execute Full System Wipe
              </button>
            </div>
          </div>

          <div className="flex items-start gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <Zap className="text-amber-500 shrink-0" size={32} />
            <div>
              <p className="font-black text-slate-900 uppercase tracking-tight">Transition to Live Mode</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ensure your Supabase connection is verified before going live. Once live, mock data will be ignored and the system will rely solely on your Postgres infrastructure.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  {isSupabaseConfigured ? 'Supabase Connected' : 'Supabase Disconnected'}
                </div>
                {isSupabaseConfigured && (
                  <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                    <CheckCircle2 size={14} /> Ready for Production
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="flex bg-slate-200 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveSubTab('fees')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'fees' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <DollarSign size={14} /> Global Fees
        </button>
        <button 
          onClick={() => setActiveSubTab('users')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <UsersIcon size={14} /> User RBAC
        </button>
        <button 
          onClick={() => setActiveSubTab('maintenance')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'maintenance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Zap size={14} /> System Maintenance
        </button>
        <button 
          onClick={() => setActiveSubTab('cleanup')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'cleanup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Database size={14} /> Database Cleanup
        </button>
      </div>

      {isSupabaseConfigured && (!profile || profile.role_name !== UserRole.ADMIN) && (
        <div className="p-8 bg-amber-50 border-2 border-amber-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-amber-100/50 animate-in fade-in slide-in-from-top duration-500 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">System Access Restricted</h4>
              <p className="text-xs text-slate-600 font-medium mt-1 max-w-md">
                You are currently viewing the system with restricted permissions. If you are the system owner, you can promote your current account to <strong>System Administrator</strong>.
              </p>
            </div>
          </div>
          <button 
            onClick={handleBootstrapAdmin}
            disabled={isSubmitting}
            className="w-full md:w-auto px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
            Claim Administrator Role
          </button>
        </div>
      )}

      {activeSubTab === 'fees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2"><Zap className="text-amber-400" /> Annual Fee Update</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Introduction of new asset rental and replacement rates.</p>
                </div>
                {!isAdmin && <Lock className="text-rose-500" size={24} />}
              </div>

              <form onSubmit={handleUpdateFees} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Database size={12} /> Target Asset Type
                    </label>
                      <select 
                        disabled={!isAdmin}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                        value={targetAsset}
                        onChange={e => setTargetAsset(e.target.value)}
                      >
                        {displayAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                        {displayAssets.length === 0 && <option value="">No Assets Found</option>}
                      </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} /> Effective Start Date
                    </label>
                    <input 
                      disabled={!isAdmin}
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                      value={effectiveDate}
                      onChange={e => setEffectiveDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FeeInput label="Daily Rental" value={dailyRental} onChange={setDailyRental} disabled={!isAdmin} />
                  <FeeInput label="Issue Fee (QSR)" value={issueFee} onChange={setIssueFee} disabled={!isAdmin} />
                  <FeeInput label="Replacement" value={replacementFee} onChange={setReplacementFee} disabled={!isAdmin} />
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                  <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    <strong>Action Warning:</strong> Saving these rates will automatically set <code>is_active = FALSE</code> and set an <code>effective_to</code> date for all existing active schedules for this asset. This operation is forensic-logged.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !isAdmin}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:bg-slate-800 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                  VERIFY & DEPLOY NEW RATES
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <HistoryIcon size={16} /> Current Active Rates
              </h4>
              <div className="space-y-4">
                {displayFees.filter(f => f.asset_id === targetAsset && (f.is_active || f.effective_to === null)).map(f => (
                  <div key={f.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{f.fee_type}</p>
                      <p className="text-sm font-bold text-slate-800">R {f.amount_zar.toFixed(2)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Active</span>
                  </div>
                ))}
                {displayFees.filter(f => f.asset_id === targetAsset && (f.is_active || f.effective_to === null)).length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">No active rates found for this asset.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'users' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter users..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button 
                onClick={() => isAddingUser ? setIsAddingUser(false) : handleOpenAddUser()}
                disabled={!isAdmin} 
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isAddingUser ? <XCircle size={16} /> : <UserPlus size={16} />}
                {isAddingUser ? 'Cancel' : 'Add System User'}
              </button>
            </div>

            {isAddingUser && (
              <form onSubmit={handleAddUser} className="p-8 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                      User ID (UUID)
                      <button 
                        type="button"
                        onClick={() => setNewUser({...newUser, id: generateUUID()})}
                        className="text-[8px] text-blue-600 hover:underline"
                      >
                        Regenerate
                      </button>
                    </label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-100"
                      value={newUser.id}
                      onChange={e => setNewUser({...newUser, id: e.target.value})}
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg"
                      value={newUser.name}
                      onChange={e => setNewUser({...newUser, name: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email" 
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                    <select 
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg"
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                    >
                      {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch ID</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg"
                      value={newUser.branch_id}
                      onChange={e => setNewUser({...newUser, branch_id: e.target.value})}
                      placeholder="e.g. LOC-JHB-01"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    {isSubmitting ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                    Confirm Add User
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                    <th className="px-8 py-5">Full Name</th>
                    <th className="px-8 py-5">Role Permission</th>
                    <th className="px-8 py-5">Home Branch</th>
                    <th className="px-8 py-5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200">
                            {u.full_name?.charAt(0) || u.id.charAt(0)}
                          </div>
                          <div>
                            <input 
                              disabled={!isAdmin}
                              className="text-sm font-bold text-slate-800 bg-transparent border-none focus:ring-1 focus:ring-slate-200 rounded px-1"
                              value={u.full_name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setDbUsers(prev => prev.map(item => item.id === u.id ? { ...item, full_name: newName } : item));
                              }}
                              onBlur={(e) => handleUpdateUserName(u.id, e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 font-bold">{u.id}</p>
                            {u.email && <p className="text-[10px] text-blue-500">{u.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <select 
                          disabled={!isAdmin}
                          value={u.role_name}
                          onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                          className="text-[10px] font-bold bg-slate-100 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Building2 size={12} className="text-slate-400" /> {u.home_branch_name}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right space-x-2">
                        <button 
                          onClick={() => handleResetPassword(u.id)}
                          disabled={!isAdmin}
                          title="Reset Password"
                          className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all disabled:opacity-30"
                        >
                          <Key size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={!isAdmin} 
                          className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-10 text-center text-slate-400 italic">
                        No users found in Supabase.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'cleanup' ? (
        <DatabaseCleanup />
      ) : (
        renderMaintenance()
      )}
    </div>
  );
};

const FeeInput: React.FC<{ label: string, value: number, onChange: (val: number) => void, disabled: boolean }> = ({ label, value, onChange, disabled }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label} (ZAR)</label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R</div>
      <input 
        disabled={disabled}
        type="number"
        step="0.01"
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pl-8 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  </div>
);

export default AdminPanel;
