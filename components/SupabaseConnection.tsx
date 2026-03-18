
import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Terminal,
  ShieldCheck,
  Globe,
  Key,
  Info,
  LogIn,
  UserPlus
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useUser } from '../UserContext';

const SupabaseConnection: React.FC = () => {
  const { user, refreshProfile } = useUser();
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'unconfigured'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthMsg(null);
    try {
      const { error } = await (supabase.auth as any).signUp({ email, password });
      if (error) throw error;
      setAuthMsg({ msg: "Check your email for the confirmation link!", type: 'success' });
    } catch (err: any) {
      setAuthMsg({ msg: err.message || "Sign up failed", type: 'error' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthMsg(null);
    try {
      const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
      if (error) throw error;
      setAuthMsg({ msg: "Signed in successfully!", type: 'success' });
      await refreshProfile();
    } catch (err: any) {
      setAuthMsg({ msg: err.message || "Sign in failed", type: 'error' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const checkConnection = async () => {
    console.log('SupabaseConnection: Checking connection... Configured:', isSupabaseConfigured);
    if (!isSupabaseConfigured) {
      setStatus('unconfigured');
      setLatency(null);
      return;
    }

    setStatus('checking');
    const start = performance.now();
    try {
      // Check core tables and views
      const requiredObjects = [
        { name: 'users', type: 'table' },
        { name: 'branches', type: 'table' },
        { name: 'asset_master', type: 'table' },
        { name: 'locations', type: 'table' },
        { name: 'batches', type: 'table' },
        { name: 'vw_global_inventory_tracker', type: 'view' },
        { name: 'vw_batch_forensics', type: 'view' },
        { name: 'vw_all_sources', type: 'view' },
        { name: 'vw_all_origins', type: 'view' },
        { name: 'vw_movement_destinations', type: 'view' },
        { name: 'vw_batch_accruals', type: 'view' }
      ];

      const results = await Promise.all(
        requiredObjects.map(obj => 
          supabase.from(obj.name).select('count', { count: 'exact', head: true })
            .then(res => ({ name: obj.name, exists: !res.error, error: res.error }))
        )
      );

      const missing = results.filter(r => !r.exists);
      if (missing.length > 0) {
        console.warn("Missing database objects:", missing);
        setErrorMsg(`Missing ${missing.length} objects: ${missing.map(m => m.name).join(', ')}`);
        setStatus('error');
      } else {
        const end = performance.now();
        setLatency(Math.round(end - start));
        setStatus('connected');
        setErrorMsg(null);
      }
    } catch (err: any) {
      console.error("Supabase connection test failed:", err);
      setStatus('error');
      setErrorMsg(err.message || "Unknown connection error");
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Database Connectivity</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Supabase Postgres Infrastructure Status</p>
        </div>
        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${
          status === 'connected' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
          status === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
          status === 'unconfigured' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
          'bg-slate-50 text-slate-400 border border-slate-100'
        }`}>
          {status === 'connected' && <CheckCircle2 size={14} />}
          {status === 'error' && <XCircle size={14} />}
          {status === 'unconfigured' && <AlertCircle size={14} />}
          {status === 'checking' && <RefreshCw size={14} className="animate-spin" />}
          {status}
        </div>
      </div>

      {/* Connection Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl"><Globe size={20} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endpoint Status</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{isSupabaseConfigured ? 'Active' : 'Missing'}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">VITE_SUPABASE_URL</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Key size={20} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Key Security</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{isSupabaseConfigured ? 'Encrypted' : 'Not Set'}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">VITE_SUPABASE_ANON_KEY</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl"><RefreshCw size={20} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Latency</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{latency ? `${latency}ms` : '--'}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Round-trip to Postgres</p>
        </div>
      </div>

      {/* Auth Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 bg-slate-900 text-white">
          <h4 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck size={24} /> Supabase Authentication
          </h4>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Sign in to your Supabase Auth instance to claim administrative roles
          </p>
        </div>
        
        <div className="p-8">
          {user ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-900 uppercase tracking-tight">Authenticated as {user.email}</p>
                  <p className="text-xs text-slate-500 font-medium">Your session is active and linked to your Supabase Auth ID.</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                Session Active
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <h5 className="font-black text-slate-900 uppercase tracking-tight">Sign In / Sign Up</h5>
                  <p className="text-xs text-slate-500 mt-1">Use your Supabase credentials to access administrative features.</p>
                </div>
                
                <form className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                    <input 
                      type="email" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="e.g. admin@shuku.co.za"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>

                  {authMsg && (
                    <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${authMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {authMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {authMsg.msg}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={handleSignIn}
                      disabled={isAuthLoading || !isSupabaseConfigured}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAuthLoading ? <RefreshCw className="animate-spin" size={14} /> : <LogIn size={14} />}
                      Sign In
                    </button>
                    <button 
                      onClick={handleSignUp}
                      disabled={isAuthLoading || !isSupabaseConfigured}
                      className="flex-1 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAuthLoading ? <RefreshCw className="animate-spin" size={14} /> : <UserPlus size={14} />}
                      Sign Up
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Info size={20} /></div>
                  <h5 className="font-black text-slate-900 uppercase tracking-tight text-xs">Why do I need to sign in?</h5>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  To claim the <strong>System Administrator</strong> role, the system needs to link your database record to a secure Supabase Auth identity. 
                  <br /><br />
                  If you haven't created an account yet, use the <strong>Sign Up</strong> button. If you have email confirmation enabled in Supabase, you'll need to check your inbox.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Status */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Database size={200} />
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
            <h4 className="font-black text-lg uppercase tracking-tight">System Logs</h4>
          </div>

          <div className="bg-black/40 rounded-2xl p-6 font-mono text-xs space-y-2 border border-white/10">
            <p className="text-slate-500">[{new Date().toISOString()}] Initializing connection handshake...</p>
            <p className="text-slate-300"><span className="text-emerald-400">INFO:</span> Environment variables detected: {isSupabaseConfigured ? 'YES' : 'NO'}</p>
            <p className="text-slate-400 text-[10px]">Checked: VITE_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY</p>
            {status === 'connected' && (
              <p className="text-emerald-400 font-bold">SUCCESS: Established secure tunnel to Supabase Cloud.</p>
            )}
            {status === 'error' && (
              <p className="text-rose-400 font-bold">CRITICAL: {errorMsg}</p>
            )}
            {status === 'unconfigured' && (
              <p className="text-amber-400 font-bold">WARNING: Supabase credentials not found in .env.local</p>
            )}
          </div>

          <button 
            onClick={checkConnection}
            className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 shadow-xl shadow-black/20"
          >
            <RefreshCw size={16} className={status === 'checking' ? 'animate-spin' : ''} />
            Re-Verify Connection
          </button>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-slate-100 text-slate-600 rounded-xl"><Info size={20} /></div>
          <h4 className="font-black text-slate-900 uppercase tracking-tight">Connection Setup Guide</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs flex-shrink-0">1</div>
              <div>
                <p className="font-black text-sm text-slate-900">Obtain Credentials</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Login to your Supabase Dashboard, navigate to Project Settings &gt; API, and copy your Project URL and anon key.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs flex-shrink-0">2</div>
              <div>
                <p className="font-black text-sm text-slate-900">Update Environment</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Paste these into your <code>.env.local</code> file using the keys <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Example .env.local</p>
              <Terminal size={14} className="text-slate-300" />
            </div>
            <pre className="text-[10px] font-mono text-slate-600 leading-relaxed">
              VITE_SUPABASE_URL=https://xyz.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
            </pre>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
            >
              Open Supabase Dashboard <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupabaseConnection;
