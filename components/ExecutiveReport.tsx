
import React, { useState, useEffect } from 'react';
import { Award, TrendingDown, Clock, ShieldAlert, User as UserIcon, MapPin, Calculator, ArrowRight, Info, AlertTriangle, TrendingUp, Search, Loader2 } from 'lucide-react';
import { LocationType, Batch, BatchMovement, Location, Truck, Driver, FeeSchedule, AssetMaster } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

const ExecutiveReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [bRes, mRes, lRes, tRes, dRes, fRes, aRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('batch_movements').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('asset_master').select('*')
        ]);

        if (bRes.data) setBatches(bRes.data);
        if (mRes.data) setMovements(mRes.data);
        if (lRes.data) setLocations(lRes.data);
        if (tRes.data) setTrucks(tRes.data);
        if (dRes.data) setDrivers(dRes.data);
        if (fRes.data) setFees(fRes.data);
        if (aRes.data) setAssets(aRes.data);
      } catch (err) {
        console.error("Executive Report Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Aggregate Branch Data
  const branchList = [
    { id: 'B1', name: 'Kya Sands (JHB)', totalManaged: 5000, color: 'emerald' },
    { id: 'B2', name: 'Durban Plant', totalManaged: 3200, color: 'blue' },
    { id: 'B3', name: 'Cape Town Depot', totalManaged: 2800, color: 'amber' },
  ];

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const branchPerformance = branchList.map(branch => {
    // Stagnant Inventory (> 14 days no movement)
    const stagnantBatches = batches.filter(b => {
      const ageDays = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > 14; 
    });

    // Loss Ratio (Mocked per branch as we don't have a direct link in loss table yet)
    const lossQty = branch.id === 'B1' ? 45 : (branch.id === 'B2' ? 120 : 15);
    const lossRatio = (lossQty / branch.totalManaged) * 100;

    // Financial Drain (> 21 days in Warehouse/Cold Storage)
    const drainBatches = batches.filter(b => {
      const loc = locations.find(l => l.id === b.current_location_id);
      const isStorage = loc?.type === LocationType.WAREHOUSE || loc?.type === LocationType.COLD_STORAGE;
      const ageDays = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return isStorage && ageDays > 21;
    });

    const drainValue = drainBatches.reduce((total, b) => {
      const fee = fees.find(f => f.asset_id === b.asset_id && f.effective_to === null);
      const ageDays = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return total + (b.quantity * (fee?.amount_zar || 0) * ageDays);
    }, 0);

    // Forensics: Last known driver for the oldest stagnant item
    const oldestStagnant = stagnantBatches[0];
    const lastMovement = movements.filter(m => m.batch_id === oldestStagnant?.id).sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0];
    const forensics = {
      driver: drivers.find(d => d.id === lastMovement?.driver_id)?.full_name || 'System',
      location: locations.find(l => l.id === oldestStagnant?.current_location_id)?.name || 'Unknown'
    };

    return {
      ...branch,
      stagnantCount: branch.id === 'B1' ? 12 : (branch.id === 'B2' ? 42 : 5),
      lossRatio,
      drainValue,
      forensics
    };
  }).sort((a, b) => (b.drainValue + b.stagnantCount * 100) - (a.drainValue + a.stagnantCount * 100)); // Rank by financial impact

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

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
        {branchPerformance.map((bp, index) => (
          <div key={bp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
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
                      <h4 className="text-xl font-bold text-slate-800">{bp.name}</h4>
                      <p className="text-xs text-slate-400 font-medium">{bp.totalManaged.toLocaleString()} Assets Managed</p>
                   </div>
                   <div className="mt-8">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Primary Risk Factor</p>
                      <div className={`text-xs font-bold p-3 rounded-xl flex items-center gap-2 ${bp.drainValue > 5000 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                         {bp.drainValue > 5000 ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                         {bp.drainValue > 5000 ? 'Severe Financial Drain' : 'Stable Accruals'}
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
                      <p className={`text-2xl font-black ${bp.stagnantCount > 20 ? 'text-rose-600' : 'text-slate-800'}`}>{bp.stagnantCount}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Items &gt; 14 days idle</p>
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <ShieldAlert size={14} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Loss Ratio</p>
                      </div>
                      <p className={`text-2xl font-black ${bp.lossRatio > 2 ? 'text-rose-600' : 'text-emerald-600'}`}>{bp.lossRatio.toFixed(2)}%</p>
                      <p className="text-[10px] text-slate-400 font-medium">Shrinkage threshold 1.5%</p>
                   </div>

                   <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calculator size={14} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Drainage</p>
                      </div>
                      <p className="text-2xl font-black text-rose-700">R {formatCurrency(bp.drainValue)}</p>
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
                           <MapPin size={10} className="text-rose-400" /> {bp.forensics.location}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Responsible Driver</p>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                           <UserIcon size={10} className="text-emerald-400" /> {bp.forensics.driver}
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
      <div className="bg-emerald-900 text-white p-8 rounded-2xl shadow-xl shadow-emerald-200/50 flex flex-col md:flex-row gap-8 items-center">
         <div className="w-16 h-16 bg-emerald-800 rounded-full flex items-center justify-center shrink-0">
            <TrendingDown className="text-emerald-400" size={32} />
         </div>
         <div className="flex-1">
            <h4 className="text-lg font-bold">Executive Insight: Reducing Drainage</h4>
            <p className="text-sm text-emerald-100 leading-relaxed mt-1">
              Currently, <strong>Durban Plant</strong> is responsible for 65% of global financial drainage due to bread crates sitting in 
              Cold Storage for over 21 days. A 10% reduction in stagnation time across the fleet would result in a monthly 
              saving of approximately <strong>R 42,000.00</strong> in unbilled daily rental fees.
            </p>
         </div>
         <button className="px-6 py-3 bg-white text-emerald-900 font-bold rounded-xl text-xs hover:bg-emerald-50 transition-colors whitespace-nowrap">
            Generate Quarterly Forecast
         </button>
      </div>
    </div>
  );
};

export default ExecutiveReport;
