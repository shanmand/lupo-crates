
import React from 'react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useUser } from '../UserContext';

const Unauthorized: React.FC = () => {
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
        <div className="mx-auto h-16 w-16 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 mb-6">
          <ShieldAlert className="h-8 w-8 text-white" />
        </div>
        
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
          Access Denied
        </h2>
        
        <div className="space-y-4">
          <p className="text-slate-400 text-sm font-medium">
            Your account (<span className="text-amber-500 font-bold">{user?.email}</span>) is authenticated but not authorized to access this system.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Please contact your system administrator to have your profile activated and assigned the correct permissions.
          </p>
        </div>

        <div className="pt-6 space-y-3">
          <a 
            href="mailto:admin@shuku.co.za" 
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-slate-700 text-white hover:bg-slate-600 transition-all border border-slate-600"
          >
            <Mail size={18} /> Contact Admin
          </a>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-400 transition-all shadow-lg shadow-rose-500/20"
          >
            Sign Out <LogOut size={18} />
          </button>
        </div>

        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
            Security Event Logged
          </p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
