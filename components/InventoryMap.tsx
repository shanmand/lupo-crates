
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { MapPin, Building2, Flame, TrendingUp, Zap, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface InventoryRecord {
  branch_name: string;
  current_location: string;
  daily_accrued_liability: number;
  batch_count: number;
  batch_id: string;
}

const InventoryMap: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('Global');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) return;
      setIsLoading(true);
      try {
        const { data: results, error } = await supabase
          .from('vw_global_inventory_tracker')
          .select('*');

        if (error) throw error;
        setData(results || []);
      } catch (err) {
        console.error("Inventory Map Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const branchAggregates = useMemo(() => {
    const aggregates: Record<string, { liability: number, count: number }> = {};
    
    data.forEach(item => {
      const branch = item?.branch_name || 'Unknown';
      if (!aggregates[branch]) {
        aggregates[branch] = { liability: 0, count: 0 };
      }
      aggregates[branch].liability += item?.daily_accrued_liability || 0;
      aggregates[branch].count += 1;
    });

    return Object.entries(aggregates).map(([name, stats]) => ({
      name,
      ...stats
    })).sort((a, b) => b.liability - a.liability);
  }, [data]);

  const totalLiability = useMemo(() => {
    return data.reduce((acc, item) => acc + (item?.daily_accrued_liability || 0), 0);
  }, [data]);

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-3xl border border-slate-200">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-slate-400 mx-auto" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapping Global Liabilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Accrued Liability</p>
            <p className="text-5xl font-black tracking-tighter">R {formatCurrency(totalLiability)}</p>
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} /> Live Financial Exposure
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Inventory Units</p>
            <p className="text-4xl font-black text-slate-900">{data.reduce((acc, i) => acc + (i?.quantity || 0), 0)}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={12} /> Across {branchAggregates.length} Branches
            </p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
            <MapPin size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Branch Liability Distribution</h4>
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
             Heat Map Aggregation by Branch Name
          </div>
        </div>

        <div className="p-8 space-y-8">
          {branchAggregates.map((branch) => {
            const maxLiability = Math.max(...branchAggregates.map(b => b.liability), 1);
            const percentage = (branch.liability / maxLiability) * 100;

            return (
              <div key={branch.name} className="space-y-3 group">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-slate-400" />
                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{branch.name}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{branch.count} Active Batches</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${branch.liability > 10000 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      R {formatCurrency(branch.liability)}
                    </p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Accrued</p>
                  </div>
                </div>
                
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      branch.liability > 10000 ? 'bg-rose-500' : 
                      branch.liability > 5000 ? 'bg-amber-500' : 
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(percentage, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InventoryMap;
