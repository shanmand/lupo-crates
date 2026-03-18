import React, { useState, useEffect } from 'react';
import { MOCK_AUDIT_LOGS, MOCK_USERS } from '../constants';
import { Activity, Clock, User, ArrowRight, Shield, Database, Receipt, Zap, Loader2 } from 'lucide-react';
import { AuditLog, User as DBUser } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setLogs(MOCK_AUDIT_LOGS);
        setUsers(MOCK_USERS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [logsRes, usersRes] = await Promise.all([
          supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }),
          supabase.from('users').select('*')
        ]);

        if (logsRes.data) setLogs(logsRes.data);
        if (usersRes.data) setUsers(usersRes.data);
      } catch (err) {
        console.error("Audit Logs Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-amber-500" size={24} />
            System Forensic Audit
          </h3>
          <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-1">Timeline of state changes and user accountability</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
              Export Audit (CSV)
           </button>
           <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
              Live Feed Active
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Statistics */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <Activity size={14} className="text-amber-500" /> Integrity Metrics
              </h4>
              <div className="space-y-6">
                 <div>
                    <p className="text-2xl font-black">{logs.length}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Total Events Logged</p>
                 </div>
                 <div>
                    <p className="text-2xl font-black text-amber-400">0.02%</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Unauthorized Attempts</p>
                 </div>
                 <div>
                    <p className="text-2xl font-black text-emerald-400">100%</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Attribution Ratio</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8">
            <div className="relative pl-8 border-l-2 border-slate-100 space-y-10">
              {logs.map((log) => {
                const user = users.find(u => u.id === log.user_id);
                return (
                  <div key={log.id} className="relative animate-in slide-in-from-left duration-500">
                    <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-slate-900 ring-4 ring-slate-50 flex items-center justify-center">
                       {log.entity_type === 'Batch' ? <Database size={8} className="text-white" /> : 
                        log.entity_type === 'Fee' ? <Receipt size={8} className="text-white" /> : <Zap size={8} className="text-white" />}
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.timestamp).toLocaleString()}</span>
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tighter">{log.entity_type} #{log.entity_id}</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1 group-hover:text-amber-600 transition-colors">
                           {log.action.replace('_', ' ')}
                        </h4>
                        <div className="mt-2 flex items-center gap-3 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                           <span className="text-slate-400 font-bold">{log.old_value}</span>
                           <ArrowRight size={12} className="text-slate-300" />
                           <span className="text-slate-800 font-black">{log.new_value}</span>
                        </div>
                      </div>

                      <div className="md:text-right shrink-0">
                        <div className="flex items-center md:justify-end gap-2">
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-800 leading-none">{user?.name || log.user_id}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{user?.role || 'System'}</p>
                           </div>
                           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                             {user?.name?.charAt(0) || 'U'}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="py-20 text-center text-slate-400 italic">No audit records found.</div>
              )}
            </div>
            
            <button className="w-full mt-10 py-3 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all">
               Load Historical Audit Data (v1.0 Archive)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditView;
