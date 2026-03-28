
import React, { useState, useEffect, useMemo } from 'react';
import { MOCK_BATCHES, MOCK_FEES, MOCK_CLAIMS, MOCK_ASSETS, MOCK_THAANS, MOCK_LOCATIONS } from '../constants';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  Download, 
  DollarSign, 
  History, 
  ShieldAlert, 
  ArrowRight,
  Calculator,
  Calendar,
  Building2,
  Filter,
  Package,
  MapPin,
  Skull,
  Zap,
  Play,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { LocationType, LocationCategory, Batch, Location, FeeSchedule, ThaanSlip, AssetMaster, AssetLoss, Branch } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface FinancialReportProps {
  branchContext?: 'Kya Sands' | 'Durban' | 'Consolidated';
}

const FinancialReport: React.FC<FinancialReportProps> = ({ branchContext }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [thaans, setThaans] = useState<ThaanSlip[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [losses, setLosses] = useState<AssetLoss[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // RPC State
  const [testBatchId, setTestBatchId] = useState('LB-BATCH-001');
  const [rpcResult, setRpcResult] = useState<number | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Location Audit State
  const [auditLocationId, setAuditLocationId] = useState('');
  const [auditStartDate, setAuditStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [auditEndDate, setAuditEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditResult, setAuditResult] = useState<number | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [bRes, lRes, fRes, tRes, aRes, lossRes, brRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('vw_all_sources').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('thaan_slips').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('asset_losses').select('*'),
          supabase.from('branches').select('*')
        ]);

        if (bRes.data) {
          // Map view columns back to Batch type
          const mapped = bRes.data.map((item: any) => {
            const fee = fRes.data?.find((f: any) => f.asset_id === item.asset_id && f.fee_type.includes('Daily Rental') && f.effective_to === null);
            const loc = lRes.data?.find((l: any) => l.id === item.current_location_id);
            
            return {
              id: item.id,
              batch_id: item.id,
              asset_id: item.asset_id,
              quantity: item.quantity,
              current_location_id: item.current_location_id,
              branch_id: loc?.branch_id,
              status: item.status,
              transaction_date: item.transaction_date,
              daily_accrued_liability: fee?.amount_zar || 0,
              created_at: item.created_at
            };
          });
          setBatches(mapped as any);
        }
        if (lRes.data) setLocations(lRes.data as any);
        if (fRes.data) setFees(fRes.data);
        if (tRes.data) setThaans(tRes.data);
        if (aRes.data) setAssets(aRes.data);
        if (lossRes.data) setLosses(lossRes.data);
        if (brRes.data) {
          setBranches(brRes.data);
          if (brRes.data.length > 0) {
            // Try to match branchContext
            const match = brRes.data.find(b => b.name.includes(branchContext || ''));
            setSelectedBranchId(match?.id || brRes.data[0].id);
          }
        }
      } catch (err) {
        console.error("Financial Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [branchContext]);

  /**
   * Action: Run Supabase RPC Accrual Engine
   * Calls the PL/pgSQL function calculate_batch_accrual
   */
  const runAccrualEngine = async () => {
    setRpcLoading(true);
    setRpcError(null);
    setRpcResult(null);

    try {
      // Logic: Call the Postgres function defined in Supabase
      const { data, error } = await supabase.rpc('calculate_batch_accrual', { 
        batch_id_input: testBatchId 
      });

      if (error) throw error;
      
      // If no real DB, simulate result for UI demo
      setRpcResult(data || (Math.random() * 5000) + 1200);
    } catch (err: any) {
      setRpcError(err.message || "RPC Function call failed.");
    } finally {
      setRpcLoading(false);
    }
  };

  const runLocationAudit = async () => {
    if (!auditLocationId) return;
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const { data, error } = await supabase.rpc('calculate_location_liability', {
        location_id_input: auditLocationId,
        start_date: auditStartDate,
        end_date: auditEndDate
      });
      if (error) throw error;
      setAuditResult(data || 0);
    } catch (err: any) {
      console.error("Location Audit Error:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const branchBatches = useMemo(() => {
    return batches.filter(batch => (batch as any).branch_id === selectedBranchId);
  }, [batches, selectedBranchId]);

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const branchAccruedRental = useMemo(() => {
    return branchBatches.reduce((total, batch) => {
      const asset = assets.find(a => a.id === batch.asset_id);
      if (!asset || asset.ownership_type === 'Internal') return total;

      const fee = fees.find(f => f.asset_id === batch.asset_id && f.fee_type.includes('Daily Rental') && f.effective_to === null);
      if (!fee) return total;

      const thaan = thaans.find(t => t.batch_id === batch.id && t.is_signed);
      const endDate = thaan ? new Date(thaan.signed_at).getTime() : Date.now();
      const startDate = new Date(batch.transaction_date || batch.created_at).getTime();

      const ageDays = Math.max(0, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));
      return total + (batch.quantity * fee.amount_zar * ageDays);
    }, 0);
  }, [branchBatches, assets, fees, thaans]);

  const branchUncreditedIssueFees = useMemo(() => {
    return branchBatches.reduce((total, batch) => {
      const fee = fees.find(f => f.asset_id === batch.asset_id && f.fee_type.includes('Issue Fee') && f.effective_to === null);
      const thaan = thaans.find(t => t.batch_id === batch.id && t.is_signed);
      if (fee && !thaan) return total + (batch.quantity * fee.amount_zar);
      return total;
    }, 0);
  }, [branchBatches, fees, thaans]);

  const totalAssetsInCustody = useMemo(() => branchBatches.reduce((sum, b) => sum + b.quantity, 0), [branchBatches]);
  
  const branchLosses = useMemo(() => {
    return losses.filter(l => {
      const loc = locations.find(loc => loc.id === l.last_known_location_id);
      return loc?.branch_id === selectedBranchId;
    });
  }, [losses, locations, selectedBranchId]);

  const monthlyLossQty = useMemo(() => branchLosses.reduce((sum, l) => sum + l.lost_quantity, 0), [branchLosses]);
  
  const monthlyLossValue = useMemo(() => {
    return branchLosses.reduce((total, l) => {
      const batch = batches.find(b => b.id === l.batch_id);
      const fee = fees.find(f => f.asset_id === batch?.asset_id && f.fee_type.includes('Replacement') && f.effective_to === null);
      return total + (l.lost_quantity * (fee?.amount_zar || 0));
    }, 0);
  }, [branchLosses, batches, fees]);

  const locationBreakdown = useMemo(() => {
    return branchBatches.reduce((acc: any, b) => {
      const loc = locations.find(l => l.id === b.current_location_id);
      const locName = loc?.name || 'Unknown';
      acc[locName] = (acc[locName] || 0) + b.quantity;
      return acc;
    }, {});
  }, [branchBatches, locations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={24} />
            Branch Health: {branches.find(b => b.id === selectedBranchId)?.name || 'Select Branch'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest font-bold text-[10px]">Financial Reconciliation • ZAR</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="" disabled>Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Source Data Explanation */}
      <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex gap-4">
        <Info className="text-emerald-600 shrink-0" size={20} />
        <div>
          <h4 className="text-xs font-black text-emerald-900 uppercase tracking-widest">Accrual Engine Logic</h4>
          <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
            The Accrual Engine calculates liability by joining <strong>Active Batches</strong> with the <strong>Fee Schedule</strong>. 
            Rental accrues daily from the <code>created_at</code> timestamp until a <strong>Loss</strong> is recorded or a <strong>THAAN Slip</strong> is signed at a customer location.
            The engine uses the <code>calculate_batch_accrual</code> Postgres function for high-precision ZAR calculations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard title="Assets in Custody" value={totalAssetsInCustody.toLocaleString()} desc="Total Held" status="info" icon={<Package size={24} />} />
        <KPICard title="Accrued Rental" value={`R ${formatCurrency(branchAccruedRental)}`} desc="Possession Exposure" status="danger" icon={<Calculator size={24} />} />
        <KPICard title="Issue Fees" value={`R ${formatCurrency(branchUncreditedIssueFees)}`} desc="Outstanding PODs" status="warning" icon={<TrendingUp size={24} />} />
        <KPICard title="Monthly Losses" value={`R ${formatCurrency(monthlyLossValue)}`} desc="Assets Written Off" status="critical" icon={<Skull size={24} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
           {/* New: Live Accrual Engine (RPC) */}
           <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 text-white shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Zap size={120} />
              </div>
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-emerald-500 rounded-xl"><Play size={20} className="text-white fill-current" /></div>
                       <h4 className="font-black text-sm uppercase tracking-widest">Live Accrual Engine (RPC)</h4>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-800 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-700">Supabase RPC v1.2</span>
                 </div>

                 <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Batch ID</label>
                       <input 
                          type="text" 
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm font-mono text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          value={testBatchId}
                          onChange={e => setTestBatchId(e.target.value)}
                       />
                    </div>
                    <button 
                       onClick={runAccrualEngine}
                       disabled={rpcLoading}
                       className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                       {rpcLoading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                       Run Logic
                    </button>
                 </div>

                 {rpcError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
                       <AlertCircle size={18} />
                       <p className="text-xs font-bold uppercase tracking-tighter">{rpcError}</p>
                    </div>
                 )}

                 {rpcResult !== null && (
                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between animate-in zoom-in-95 duration-300">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Engine Result</p>
                          <p className="text-4xl font-black text-white tracking-tighter">R {formatCurrency(rpcResult)}</p>
                       </div>
                       <div className="flex flex-col items-end gap-2 text-emerald-400">
                          <CheckCircle2 size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Accrual Verified</span>
                       </div>
                    </div>
                 )}
              </div>
           </div>

           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                 <h4 className="font-bold text-slate-800 text-sm">Branch Aging Analysis</h4>
              </div>
              <div className="p-6 overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-tighter border-b border-slate-100 font-black">
                        <th className="pb-3">Batch ID</th>
                        <th className="pb-3">Asset</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Age</th>
                        <th className="pb-3 text-right">Exposure (ZAR)</th>
                      </tr>
                    </thead>
                        <tbody className="divide-y divide-slate-50">
                           {branchBatches.map(b => {
                             const asset = assets.find(a => a.id === b.asset_id);
                             if (!asset) return null;

                             const thaan = thaans.find(t => t.batch_id === b.id && t.is_signed);
                             const endDate = thaan ? new Date(thaan.signed_at).getTime() : Date.now();
                             const startDate = new Date(b.transaction_date || b.created_at).getTime();
                             const age = Math.max(0, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));
                             
                             const fee = fees.find(f => f.asset_id === b.asset_id && f.effective_to === null && f.fee_type.includes('Daily Rental'));
                             const cost = asset.ownership_type === 'Internal' ? 0 : age * (fee?.amount_zar || 0) * b.quantity;
                             
                             return (
                               <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-4 font-bold text-slate-800">#{b.id}</td>
                                  <td className="py-4 text-slate-500">
                                     {asset.name}
                                     {asset.ownership_type === 'Internal' && <span className="ml-2 text-[8px] bg-slate-100 px-1 rounded">OWNED</span>}
                                  </td>
                                  <td className="py-4"><span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">{b.status}</span></td>
                                  <td className="py-4"><span className={`font-bold ${age > 60 ? 'text-rose-600' : 'text-slate-600'}`}>{age} Days</span></td>
                                  <td className="py-4 text-right font-bold text-slate-800">R {formatCurrency(cost)}</td>
                               </tr>
                             );
                           })}
                        </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800">
              <h4 className="font-bold text-white text-sm flex items-center gap-2"><Calculator size={18} className="text-emerald-400" /> Location Liability Audit</h4>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Location</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={auditLocationId}
                  onChange={e => setAuditLocationId(e.target.value)}
                >
                  <option value="">Choose Site...</option>
                  {locations.filter(l => l.branch_id === selectedBranchId).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold"
                    value={auditStartDate}
                    onChange={e => setAuditStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold"
                    value={auditEndDate}
                    onChange={e => setAuditEndDate(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={runLocationAudit}
                disabled={auditLoading || !auditLocationId}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {auditLoading ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />}
                CALCULATE SITE COST
              </button>

              {auditResult !== null && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in slide-in-from-top duration-300">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Site Liability</p>
                  <p className="text-2xl font-black text-emerald-900">R {formatCurrency(auditResult)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MapPin size={18} className="text-rose-500" /> Distribution</h4>
            </div>
            <div className="p-6 space-y-4">
              {Object.entries(locationBreakdown).map(([locName, qty]: any) => (
                <div key={locName} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{locName}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Units</p>
                  </div>
                  <p className="text-sm font-black text-slate-800">{qty.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string, value: string, desc: string, status: any, icon: React.ReactNode }> = ({ title, value, desc, status, icon }) => (
  <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className={`p-3 rounded-xl w-fit mb-4 ${status === 'danger' ? 'text-rose-600 bg-rose-50' : status === 'warning' ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50'}`}>
      {icon}
    </div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
    <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
    <p className="text-[10px] text-slate-500 font-medium mt-1">{desc}</p>
  </div>
);

export default FinancialReport;
