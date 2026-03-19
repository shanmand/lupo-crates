
import React, { useState, useEffect } from 'react';
import { Award, TrendingDown, Clock, ShieldAlert, User as UserIcon, MapPin, Calculator, ArrowRight, Info, AlertTriangle, TrendingUp, Search, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

interface ExecutiveReportData {
  branch_id: string;
  branch_name: string;
  total_units: number;
  stagnant_units: number;
  financial_drainage: number;
  lost_units: number;
  loss_ratio: number;
  oldest_stagnant_driver: string | null;
  oldest_stagnant_location: string | null;
  oldest_stagnant_batch_id: string | null;
}

const ExecutiveReport: React.FC = () => {
  const [reportData, setReportData] = useState<ExecutiveReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('vw_executive_report')
          .select('*')
          .order('financial_drainage', { ascending: false });

        if (error) throw error;
        if (data) setReportData(data);
      } catch (err) {
        console.error("Executive Report Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Calculate global insights
  const totalDrainage = reportData.reduce((sum, d) => sum + d.financial_drainage, 0);
  const topDrainBranch = reportData[0];
  const potentialSavings = totalDrainage * 0.1;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-amber-500" size={24} />
            Branch Performance Audit
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cross-Branch Efficiency Ranking • SA Logistics</p>
        </div>
        <div className="flex gap-4">
           <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Report Period</p>
              <p className="text-sm font-bold text-slate-800">Current Fiscal Month</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reportData.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
            <AlertTriangle className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No Branch Performance Data Found</p>
          </div>
        ) : reportData.map((bp, index) => (
          <div key={bp.branch_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
             <div className="grid grid-cols-1 lg:grid-cols-12">
                
                {/* Branch Identity */}
                <div className="lg:col-span-3 p-8 bg-slate-50 border-r border-slate-100 flex flex-col justify-between">
                   <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${index === 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {index === 0 ? 'Urgent Action' : 'Operational'}
                        </span>
                        <span className="text-2xl font-black text-slate-300">#0{index + 1}</span>
                      </div>
                      <h4 className="text-xl font-bold text-slate-800">{bp.branch_name}</h4>
                      <p className="text-xs text-slate-400 font-medium">{bp.total_units.toLocaleString()} Assets Managed</p>
                   </div>
                   <div className="mt-8">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Primary Risk Factor</p>
                      <div className={`text-xs font-bold p-3 rounded-xl flex items-center gap-2 ${bp.financial_drainage > 5000 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                         {bp.financial_drainage > 5000 ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                         {bp.financial_drainage > 5000 ? 'Severe Financial Drain' : 'Stable Accruals'}
                      </div>
                   </div>
                </div>

                {/* Metrics */}
                <div className="lg:col-span-6 p-8 grid grid-cols-3 gap-8 items-center">
                   <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock size={14} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Stagnant</p>
                      </div>
                      <p className={`text-2xl font-black ${bp.stagnant_units > 20 ? 'text-rose-600' : 'text-slate-800'}`}>{bp.stagnant_units}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Items &gt; 14 days idle</p>
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <ShieldAlert size={14} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Loss Ratio</p>
                      </div>
                      <p className={`text-2xl font-black ${bp.loss_ratio > 2 ? 'text-rose-600' : 'text-emerald-600'}`}>{bp.loss_ratio.toFixed(2)}%</p>
                      <p className="text-[10px] text-slate-400 font-medium">Shrinkage threshold 1.5%</p>
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calculator size={14} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Drainage</p>
                      </div>
                      <p className="text-2xl font-black text-rose-700">R {formatCurrency(bp.financial_drainage)}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Accrued sitting fees</p>
                   </div>
                </div>

                {/* Forensics */}
                <div className="lg:col-span-3 p-8 border-l border-slate-50 space-y-4 flex flex-col justify-center">
                   <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                         <Search size={64} />
                      </div>
                      <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                        <Info size={12} /> Last Known Forensics
                      </h5>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Oldest Stagnant Location</p>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                           <MapPin size={10} className="text-rose-400" /> {bp.oldest_stagnant_location || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Responsible Driver</p>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                           <UserIcon size={10} className="text-emerald-400" /> {bp.oldest_stagnant_driver || 'System'}
                        </p>
                      </div>
                      <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-[10px] font-black uppercase rounded-lg transition-colors">
                        Investigate Batch
                      </button>
                   </div>
                </div>

             </div>
          </div>
        ))}
      </div>

      {/* Analysis Insight */}
      {topDrainBranch && (
        <div className="bg-emerald-900 text-white p-8 rounded-2xl shadow-xl shadow-emerald-200/50 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-16 h-16 bg-emerald-800 rounded-full flex items-center justify-center shrink-0">
              <TrendingDown className="text-emerald-400" size={32} />
           </div>
           <div className="flex-1">
              <h4 className="text-lg font-bold">Executive Insight: Reducing Drainage</h4>
              <p className="text-sm text-emerald-100 leading-relaxed mt-1">
                Currently, <strong>{topDrainBranch.branch_name}</strong> is responsible for {((topDrainBranch.financial_drainage / (totalDrainage || 1)) * 100).toFixed(0)}% of global financial drainage due to assets sitting idle for over 21 days. A 10% reduction in stagnation time across the fleet would result in a monthly 
                saving of approximately <strong>R {formatCurrency(potentialSavings)}</strong> in unbilled daily rental fees.
              </p>
           </div>
           <button className="px-6 py-3 bg-white text-emerald-900 font-bold rounded-xl text-xs hover:bg-emerald-50 transition-colors whitespace-nowrap">
              Generate Quarterly Forecast
           </button>
        </div>
      )}
    </div>
  );
};

export default ExecutiveReport;
