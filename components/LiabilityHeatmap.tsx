
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  MapPin, 
  Building2, 
  Zap, 
  Loader2, 
  Filter,
  ArrowRight,
  Clock,
  Flame
} from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { Branch } from '../types';
import { formatCurrency } from '../constants';

interface DailyBurnRecord {
  branch_name: string;
  location_name: string;
  location_id: string;
  branch_id: string;
  daily_burn_rate: number;
  batch_count: number;
  avg_duration_days: number;
}

const LiabilityHeatmap: React.FC = () => {
  const [data, setData] = useState<DailyBurnRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('Global');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [batchesRes, sources, branchesRes, feesRes] = await Promise.all([
          supabase.from('batches').select('*').eq('transfer_confirmed_by_customer', false),
          fetchAllSources(),
          supabase.from('branches').select('*').order('name'),
          supabase.from('fee_schedule').select('*').is('effective_to', null)
        ]);

        if (batchesRes.error) throw batchesRes.error;
        if (branchesRes.error) throw branchesRes.error;

        const batches = batchesRes.data || [];
        const fees = feesRes.data || [];
        const branchesData = branchesRes.data || [];

        // Reconstruct burn rate data client-side
        const burnMap = new Map();
        
        batches.forEach(bt => {
          const source = sources.find(s => s.id === bt.current_location_id);
          if (!source) return;

          const branch = branchesData.find(br => br.id === source.branch_id);
          const fee = fees.find(fs => fs.asset_id === bt.asset_id);
          if (!fee) return;

          const key = source.id;
          const burnAmount = bt.quantity * fee.amount_zar;
          const durationDays = (new Date().getTime() - new Date(bt.transaction_date || bt.created_at).getTime()) / 86400000;

          if (!burnMap.has(key)) {
            burnMap.set(key, {
              branch_name: branch?.name || 'Global/Unassigned',
              location_name: source.name,
              location_id: source.id,
              branch_id: branch?.id || '',
              daily_burn_rate: 0,
              batch_count: 0,
              total_duration: 0
            });
          }

          const entry = burnMap.get(key);
          entry.daily_burn_rate += burnAmount;
          entry.batch_count += 1;
          entry.total_duration += durationDays;
        });

        const burnRecords = Array.from(burnMap.values()).map(entry => ({
          ...entry,
          avg_duration_days: entry.total_duration / entry.batch_count
        })).sort((a, b) => b.daily_burn_rate - a.daily_burn_rate);

        setData(burnRecords as any);
        setBranches(branchesData);
      } catch (err) {
        console.error("Heatmap Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (filter === 'Global') return data;
    return data.filter(d => d.branch_name.includes(filter));
  }, [data, filter]);

  const totalDailyBurn = useMemo(() => {
    return filteredData.reduce((acc, d) => acc + d.daily_burn_rate, 0);
  }, [filteredData]);

  const topBottleneck = useMemo(() => {
    if (filteredData.length === 0) return null;
    return [...filteredData].sort((a, b) => b.avg_duration_days - a.avg_duration_days)[0];
  }, [filteredData]);

  const getHeatColor = (rate: number) => {
    if (rate > 5000) return 'bg-rose-500';
    if (rate >= 1000) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getHeatText = (rate: number) => {
    if (rate > 5000) return 'text-rose-600';
    if (rate >= 1000) return 'text-amber-600';
    return 'text-emerald-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-white rounded-3xl border border-slate-200">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-slate-400 mx-auto" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyzing Financial Drain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20">
            <Flame size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Liability Heatmap</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Real-time Daily Burn Analysis</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {['Global', ...branches.map(b => b.name)].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filter === f ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* High-Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Daily Burn</p>
            <p className="text-5xl font-black tracking-tighter">{formatCurrency(totalDailyBurn)}</p>
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} /> Accruing every 24 hours
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Bottleneck</p>
            {topBottleneck ? (
              <>
                <p className="text-2xl font-black text-slate-900">{topBottleneck.location_name}</p>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> Avg {Math.round(topBottleneck.avg_duration_days)} Days Unconfirmed
                </p>
              </>
            ) : (
              <p className="text-2xl font-black text-slate-300 italic">No Data</p>
            )}
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
            <AlertCircle size={32} />
          </div>
        </div>
      </div>

      {/* Heatmap Bars */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Location Cost Ranking</h4>
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Critical</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Efficient</span>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-slate-300 italic text-sm">No active liability found for this view.</div>
          ) : (
            filteredData.map((record, idx) => {
              const maxBurn = Math.max(...data.map(d => d.daily_burn_rate), 10000);
              const percentage = (record.daily_burn_rate / maxBurn) * 100;

              return (
                <div key={record.location_id} className="space-y-3 group">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-slate-400" />
                        <span className="text-sm font-black text-slate-800">{record.location_name}</span>
                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">{record.branch_name}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.batch_count} Active Batches</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${getHeatText(record.daily_burn_rate)}`}>{formatCurrency(record.daily_burn_rate)}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Per Day</p>
                    </div>
                  </div>
                  
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${getHeatColor(record.daily_burn_rate)}`}
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Policy Notice */}
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-6">
        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Executive Summary Logic</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            This heatmap visualizes the <strong>Daily Financial Drain</strong> across all sites. Red bars indicate locations where equipment is stagnant, incurring significant rental costs without customer confirmation. The <strong>Top Bottleneck</strong> identifies where equipment sits the longest, signaling a need for urgent logistics intervention or POD reconciliation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiabilityHeatmap;
