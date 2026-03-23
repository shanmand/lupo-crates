
import React, { useState, useEffect } from 'react';
import { Truck, Package, AlertTriangle, TrendingUp, ShieldAlert, User as UserIcon, UserCheck, Loader2, Zap, Activity, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { User as UserType, DashboardStats, BatchForensics } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { MOCK_BATCHES, MOCK_LOCATIONS } from '../constants';

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
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isSupabaseConfigured) {
        // Mock data fallback
        const mockStats: DashboardStats = {
          total_units: 2455,
          pending_units: 320,
          success_units: 1250,
          stagnant_units: 45,
          pending_charges: 15420.50,
          accrued_rental: 42500.00,
          branch_name: branchContext
        };
        setStats(mockStats);
        
        const mockActivity: BatchForensics[] = MOCK_BATCHES.slice(0, 10).map(b => ({
          date: b.transaction_date || new Date().toISOString(),
          type: b.condition,
          batch_id: b.id,
          from_location: 'Main Warehouse',
          to_location: MOCK_LOCATIONS.find(l => l.id === b.current_location_id)?.name || 'Unknown',
          branch_name: branchContext,
          quantity: b.quantity,
          timestamp: new Date().toISOString()
        }));
        setRecentActivity(mockActivity);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSchemaError(null);
      try {
        let statsQuery = supabase.from('vw_dashboard_stats').select('*');
        let activityQuery = supabase.from('vw_batch_forensics').select('*').limit(20);

        if (branchContext && branchContext !== 'Consolidated') {
          statsQuery = statsQuery.eq('branch_name', branchContext);
          activityQuery = activityQuery.eq('branch_name', branchContext);
        }

        const [statsRes, activityRes] = await Promise.all([
          branchContext === 'Consolidated' ? statsQuery : statsQuery.single(),
          activityQuery.order('timestamp', { ascending: false })
        ]);

        if (statsRes.error) console.log("Supabase Stats Error:", statsRes.error);
        if (activityRes.error) {
          console.log("Supabase Activity Error:", activityRes.error);
          if (activityRes.error.code === '42703') {
            setSchemaError("The database view 'vw_batch_forensics' is outdated. Please run the migrations in the Schema tab.");
          }
        }

        if (branchContext === 'Consolidated' && Array.isArray(statsRes.data)) {
          const consolidated = statsRes.data.reduce((acc, curr) => ({
            total_units: (acc.total_units || 0) + (curr.total_units || 0),
            pending_units: (acc.pending_units || 0) + (curr.pending_units || 0),
            success_units: (acc.success_units || 0) + (curr.success_units || 0),
            stagnant_units: (acc.stagnant_units || 0) + (curr.stagnant_units || 0),
            pending_charges: (acc.pending_charges || 0) + (curr.pending_charges || 0),
            accrued_rental: (acc.accrued_rental || 0) + (curr.accrued_rental || 0),
            branch_name: 'Consolidated'
          }), {} as DashboardStats);
          setStats(consolidated);
        } else {
          setStats(statsRes.data || {
            total_units: 0,
            pending_units: 0,
            success_units: 0,
            stagnant_units: 0,
            pending_charges: 0,
            accrued_rental: 0,
            branch_name: branchContext || 'N/A'
          });
        }

        if (activityRes.data) {
          const mappedActivity = activityRes.data.map((item: any) => ({
            date: item.date || item.transaction_date || item.timestamp,
            type: item.type || item.condition || 'unknown',
            batch_id: item.batch_id || item.batchId || 'N/A',
            quantity: item.quantity,
            from_location: item.from_location || 'N/A',
            to_location: item.to_location || 'N/A',
            branch_name: item.branch_name || 'N/A',
            timestamp: item.timestamp || new Date().toISOString()
          }));
          setRecentActivity(mappedActivity);
        } else {
          setRecentActivity([]);
        }
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [branchContext]);

  const formatCurrency = (val: any) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return new Intl.NumberFormat('en-ZA', { 
      style: 'currency', 
      currency: 'ZAR',
      minimumFractionDigits: 2 
    }).format(isNaN(num) ? 0 : num);
  };

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

  const displayStats = stats || {
    total_units: 0,
    pending_units: 0,
    success_units: 0,
    stagnant_units: 0,
    pending_charges: 0,
    accrued_rental: 0,
    branch_name: branchContext
  };

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <DashboardCard label="Total Units" value={displayStats.total_units || 0} icon={<Package className="text-blue-400" />} />
        <DashboardCard label="Pending" value={displayStats.pending_units || 0} icon={<Clock className="text-amber-400" />} />
        <DashboardCard label="Success" value={displayStats.success_units || 0} icon={<CheckCircle className="text-emerald-400" />} />
        <DashboardCard label="Stagnant" value={displayStats.stagnant_units || 0} icon={<AlertTriangle className="text-rose-400" />} />
        <DashboardCard label="Pending Charges" value={formatCurrency(displayStats.pending_charges || 0)} icon={<DollarSign className="text-rose-400" />} />
        <DashboardCard label="Accrued Rental" value={formatCurrency(displayStats.accrued_rental || 0)} icon={<TrendingUp className="text-emerald-400" />} />
      </div>

      {/* Recent Activity Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Recent Activity Log</h3>
            {schemaError && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <AlertTriangle size={10} />
                Schema Outdated
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Last 20 Movements</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-slate-950/30">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">From</th>
                <th className="px-6 py-4">To</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentActivity.map((activity, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-300">
                    {activity.date ? new Date(activity.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">
                    {activity.type}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-emerald-500">
                    {activity.batch_id}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{activity.from_location}</td>
                  <td className="px-6 py-4 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{activity.to_location}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">{activity.branch_name}</td>
                  <td className="px-6 py-4 text-xs font-black text-emerald-400 text-right tabular-nums">{activity.quantity || 0}</td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">
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
