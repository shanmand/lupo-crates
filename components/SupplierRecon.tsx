
import React, { useState, useEffect } from 'react';
import { AssetLoss, FeeType, LossType, Batch, FeeSchedule, AssetMaster, Location } from '../types';
import { 
  HandCoins, 
  Bell, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  ArrowRight, 
  Calculator, 
  MapPin, 
  History, 
  Zap,
  Printer,
  ChevronDown,
  CreditCard,
  Trash2,
  Loader2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

const SupplierRecon: React.FC = () => {
  const [losses, setLosses] = useState<AssetLoss[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filter, setFilter] = useState<'all' | 'notified' | 'unbilled'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [lossRes, batchRes, feeRes, assetRes, locRes] = await Promise.all([
          supabase.from('asset_losses').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('locations').select('*')
        ]);

        if (lossRes.data) setLosses(lossRes.data);
        if (batchRes.data) setBatches(batchRes.data);
        if (feeRes.data) setFees(feeRes.data);
        if (assetRes.data) setAssets(assetRes.data);
        if (locRes.data) setLocations(locRes.data);
      } catch (err) {
        console.error("Supplier Recon Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper: Find replacement fee for asset at time of loss
  const getReplacementFee = (assetId: string, timestamp: string) => {
    return fees.find(f => 
      f.asset_id === assetId && 
      f.fee_type === FeeType.REPLACEMENT_FEE &&
      new Date(timestamp) >= new Date(f.effective_from) &&
      (!f.effective_to || new Date(timestamp) <= new Date(f.effective_to))
    );
  };

  const handleToggleNotification = async (id: string) => {
    const loss = losses.find(l => l.id === id);
    if (!loss) return;

    const newValue = !loss.supplier_notified;
    
    setLosses(prev => prev.map(l => 
      l.id === id ? { ...l, supplier_notified: newValue } : l
    ));

    if (isSupabaseConfigured) {
      await supabase.from('asset_losses').update({ supplier_notified: newValue }).eq('id', id);
    }
  };

  const calculateSettlement = (loss: AssetLoss) => {
    const batch = batches.find(b => b.id === loss.batch_id);
    const fee = getReplacementFee(batch?.asset_id || '', loss.timestamp);
    const baseAmount = loss.lost_quantity * (fee?.amount_zar || 0);
    
    if (loss.loss_type === LossType.SCRAPPED) {
        return baseAmount * 0.90; // 10% Salvage Credit logic
    }
    return baseAmount;
  };

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredLosses = losses.filter(l => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'notified' && l.supplier_notified) ||
                         (filter === 'unbilled' && l.supplier_notified && !l.supplier_invoice_ref);
    
    const matchesDate = (!startDate || new Date(l.timestamp) >= new Date(startDate)) &&
                       (!endDate || new Date(l.timestamp) <= new Date(endDate));
    
    const matchesLocation = selectedLocation === 'all' || l.last_known_location_id === selectedLocation;

    return matchesFilter && matchesDate && matchesLocation;
  });

  const totalUnbilledLossValue = losses
    .filter(l => l.supplier_notified && !l.supplier_invoice_ref)
    .reduce((total, l) => total + calculateSettlement(l), 0);

  const totalRechargeableValue = losses.filter(l => l.is_rechargeable).reduce((acc, l) => acc + calculateSettlement(l), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Unbilled Settlement Exposure</p>
          <p className="text-3xl font-bold">R {formatCurrency(totalUnbilledLossValue)}</p>
          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold mt-2 uppercase">
            <AlertTriangle size={12} /> After Scrapped/Salvage Credits
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rechargeable Value</p>
            <p className="text-2xl font-bold text-amber-600">
               R {formatCurrency(totalRechargeableValue)}
            </p>
          </div>
          <CreditCard className="text-amber-500 opacity-20" size={40} />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Audit Trail Active</p>
            <p className="text-2xl font-bold text-emerald-600">100%</p>
          </div>
          <CheckCircle2 className="text-emerald-500 opacity-20" size={40} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <HandCoins size={18} className="text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Supplier Reconciliation</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
              <input 
                type="date" 
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
              <input 
                type="date" 
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <select 
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none"
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
            >
              <option value="all">All Partners</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.partner_type})</option>)}
            </select>
            <div className="flex gap-2">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
              <FilterButton active={filter === 'unbilled'} onClick={() => setFilter('unbilled')} label="Unbilled" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-4">Ref & Type</th>
                <th className="px-8 py-4">Asset Detail</th>
                <th className="px-8 py-4">Forensics</th>
                <th className="px-8 py-4 text-right">Settlement (ZAR)</th>
                <th className="px-8 py-4">Billing State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLosses.map(loss => {
                const batch = batches.find(b => b.id === loss.batch_id);
                const asset = assets.find(a => a.id === batch?.asset_id);
                const fee = getReplacementFee(asset?.id || '', loss.timestamp);
                const settlement = calculateSettlement(loss);
                const location = locations.find(l => l.id === loss.last_known_location_id);

                return (
                  <tr key={loss.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-slate-800">#{loss.id}</p>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          loss.loss_type === LossType.MISSING ? 'bg-slate-100 text-slate-600' :
                          loss.loss_type === LossType.SCRAPPED ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                      }`}>
                          {loss.loss_type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{asset?.name}</p>
                          <p className="text-[10px] text-slate-400">{loss.lost_quantity} Units</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                          <MapPin size={10} className="text-rose-500" /> {location?.name}
                        </div>
                        {loss.is_rechargeable && (
                           <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold uppercase">
                             <CreditCard size={10} /> Rechargeable
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-800">R {formatCurrency(settlement)}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {loss.loss_type === LossType.SCRAPPED ? 'Salvage Rate Applied' : `Rate: R ${fee?.amount_zar.toFixed(2)}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div 
                            onClick={() => handleToggleNotification(loss.id)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${loss.supplier_notified ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${loss.supplier_notified ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Notified</span>
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const FilterButton: React.FC<{ active: boolean, onClick: () => void, label: string }> = ({ active, onClick, label }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      active ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'
    }`}
  >
    {label}
  </button>
);

export default SupplierRecon;
