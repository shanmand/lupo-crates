
import React, { useState, useEffect } from 'react';
import { Truck, Package, AlertTriangle, TrendingUp, ShieldAlert, User as UserIcon, UserCheck, Loader2, Zap, Activity } from 'lucide-react';
import { User as UserType, DashboardStats, BatchForensics } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface DashboardViewProps {
  currentUser: UserType;
  branchContext?: 'Consolidated' | 'Kya Sands' | 'Durban';
  onDrillDown?: () => void;
  onSchemaFix?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, branchContext = 'Consolidated' }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<BatchForensics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [statsRes, activityRes] = await Promise.all([
          supabase.from('vw_dashboard_stats').select('*').single(),
          supabase.from('vw_batch_forensics').select('*').limit(20)
        ]);

        if (statsRes.data) setStats(statsRes.data);
        if (activityRes.data) setRecentActivity(activityRes.data);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [branchContext]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-ZA', { 
      style: 'currency', 
      currency: 'ZAR',
      minimumFractionDigits: 2 
    }).format(val);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-emerald-500 mx-auto" size={48} />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Aggregating Fleet Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!stats) return (
    <div className="p-8 text-center text-slate-500">
      <AlertTriangle className="mx-auto mb-4 opacity-20" size={48} />
      <p className="font-black uppercase tracking-widest text-sm">No Dashboard Data Available</p>
    </div>
  );

  return (
    <div className="space-y-8 p-8 bg-slate-950 min-h-screen text-slate-200">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">EXECUTIVE DASHBOARD</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
            Real-time Fleet & Liability Overview • {branchContext}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Status</p>
          <p className="text-xs font-bold text-white">LIVE FEED ACTIVE</p>
        </div>
      </div>

      {/* Top Row: Fleet Status */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <DashboardCard label="Available" value={stats.available} icon={<Package className="text-emerald-400" />} />
        <DashboardCard label="At Customers" value={stats.at_customers} icon={<UserIcon className="text-blue-400" />} />
        <DashboardCard label="In Transit" value={stats.in_transit} icon={<Truck className="text-amber-400" />} />
        <DashboardCard label="Maintenance" value={stats.maintenance} icon={<AlertTriangle className="text-rose-400" />} />
        <DashboardCard label="Total Fleet" value={stats.total_fleet} icon={<Activity className="text-slate-400" />} />
      </div>

      {/* Middle Row: Financial Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AlertCard label="Lost / Missing" value={stats.lost_missing} color="rose" />
        <AlertCard label="Damaged" value={stats.damaged} color="rose" />
        <AlertCard label="Pending Charges" value={formatCurrency(stats.pending_charges)} color="amber" />
        <AlertCard label="Open Loss Cases" value={stats.open_loss_cases} color="amber" />
      </div>

      {/* Bottom Row: Liability */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardCard label="Accrued Rental" value={formatCurrency(stats.accrued_rental)} icon={<TrendingUp className="text-emerald-400" />} />
        <DashboardCard label="Settlement Liability" value={formatCurrency(stats.settlement_liability)} icon={<ShieldAlert className="text-blue-400" />} />
        <DashboardCard label="Active Customers" value={stats.active_customers} icon={<UserCheck className="text-indigo-400" />} />
        <DashboardCard label="Movements Today" value={stats.movements_today} icon={<Zap className="text-amber-400" />} />
      </div>

      {/* Recent Activity Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Recent Activity Log</h3>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Last 20 Movements</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-slate-950/30">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">From</th>
                <th className="px-6 py-4">To</th>
                <th className="px-6 py-4 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentActivity.map((activity, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-300">
                    {new Date(activity.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      activity.type.toLowerCase().includes('clean') ? 'bg-emerald-500/10 text-emerald-500' : 
                      activity.type.toLowerCase().includes('dirty') ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {activity.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{activity.from_location}</td>
                  <td className="px-6 py-4 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{activity.to_location}</td>
                  <td className="px-6 py-4 text-xs font-black text-emerald-400 text-right tabular-nums">{activity.quantity}</td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">
                    No recent movements recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DashboardCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all group shadow-lg">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">{icon}</div>
    </div>
    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</h4>
    <p className="text-2xl font-black text-white mt-1 tracking-tight tabular-nums">{value}</p>
  </div>
);

const AlertCard: React.FC<{ label: string, value: string | number, color: 'rose' | 'amber' }> = ({ label, value, color }) => (
  <div className={`bg-slate-900 p-6 rounded-2xl border-l-4 ${
    color === 'rose' ? 'border-rose-500 shadow-rose-500/5' : 'border-amber-500 shadow-amber-500/5'
  } hover:bg-slate-800/50 transition-all shadow-lg`}>
    <h4 className={`text-[10px] font-black uppercase tracking-widest ${color === 'rose' ? 'text-rose-400' : 'text-amber-400'}`}>{label}</h4>
    <p className="text-2xl font-black text-white mt-1 tracking-tight tabular-nums">{value}</p>
  </div>
);

export default DashboardView;
