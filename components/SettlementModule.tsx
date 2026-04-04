
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { Location, Batch, AssetMaster, FeeSchedule, User, UserRole, Settlement } from '../types';
import { formatCurrency } from '../constants';
import { Receipt, DollarSign, Calendar, MapPin, Calculator, Loader2, CheckCircle2, AlertTriangle, TrendingUp, Info, Download, Trash2, History as HistoryIcon } from 'lucide-react';

interface SettlementModuleProps {
  currentUser: User;
}

const SettlementModule: React.FC<SettlementModuleProps> = ({ currentUser }) => {
  const [suppliers, setSuppliers] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [partiesRes, assetsRes, feesRes, settlementsRes] = await Promise.all([
          supabase.from('business_parties').select('*').eq('party_type', 'Supplier').order('name'),
          supabase.from('asset_master').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('settlements').select('*').order('created_at', { ascending: false })
        ]);
        if (partiesRes.data) setSuppliers(partiesRes.data as any);
        if (assetsRes.data) setAssets(assetsRes.data);
        if (feesRes.data) setFees(feesRes.data);
        if (settlementsRes.data) setSettlements(settlementsRes.data);
      } catch (err) {
        console.error("Settlement Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedSupplier || !isSupabaseConfigured) {
        setBatches([]);
        return;
      }
      
      setIsCalculating(true);
      try {
        const { data, error } = await supabase.rpc('get_supplier_liability', {
          p_supplier_id: selectedSupplier,
          p_start_date: startDate,
          p_end_date: endDate
        });

        if (error) throw error;
        
        // Map RPC result to match the expected structure in the table
        const mappedBatches = (data || []).map((r: any) => ({
          id: r.batch_id,
          asset_name: r.asset_name,
          days: r.days,
          amount_zar: r.amount_zar,
          liability_type: r.liability_type
        }));

        setBatches(mappedBatches);
      } catch (err: any) {
        setNotification({ message: err.message || "Failed to fetch liabilities", type: 'error' });
      } finally {
        setIsCalculating(false);
      }
    };
    fetchBatches();
  }, [selectedSupplier, startDate, endDate]);

  const totalGrossLiability = useMemo(() => {
    return batches.reduce((acc, b: any) => acc + Number(b.amount_zar), 0);
  }, [batches]);

  const netPayable = Math.max(0, totalGrossLiability - discount);

  const handleSettle = async () => {
    if (!selectedSupplier || !isSupabaseConfigured || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('finalize_payment_settlement', {
        p_supplier_id: selectedSupplier,
        p_start_date: startDate,
        p_end_date: endDate,
        p_gross_liability: totalGrossLiability,
        p_discount_amount: discount,
        p_net_payable: netPayable,
        p_cash_paid: netPayable, // Assuming full payment for now in this module
        p_payment_ref: paymentRef,
        p_settled_by: currentUser.id && currentUser.id !== 'dev' ? currentUser.id : (currentUser.email || 'System')
      });

      if (error) throw error;

      setNotification({ message: "Settlement processed successfully.", type: 'success' });
      
      // Reset form
      setSelectedSupplier('');
      setDiscount(0);
      setPaymentRef('');
      setBatches([]);
      
      // Refresh settlements list
      const { data: settlementsData } = await supabase.from('settlements').select('*').order('created_at', { ascending: false });
      if (settlementsData) setSettlements(settlementsData);

    } catch (err: any) {
      setNotification({ message: err.message || "Failed to process settlement.", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (isLoading && !selectedSupplier) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settlement Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Supplier Settlement</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cash Reconciliation & Liability Closure</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} className="text-rose-500" /> Supplier
                  </label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    value={selectedSupplier}
                    onChange={e => setSelectedSupplier(e.target.value)}
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-blue-500" /> Start Date
                  </label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-blue-500" /> End Date
                  </label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {selectedSupplier && (batches.length > 0 || isCalculating) ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {isCalculating ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="animate-spin text-amber-500" size={48} />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Calculating Liabilities...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Days</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Liability</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {batches.map((batch: any) => (
                            <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 text-xs font-bold text-slate-900">#{batch.id}</td>
                              <td className="py-4 text-xs text-slate-600">{batch.asset_name}</td>
                              <td className="py-4 text-xs font-black text-slate-900">{batch.days || '-'}</td>
                              <td className="py-4">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                  batch.liability_type === 'Rental' ? 'bg-blue-100 text-blue-700' :
                                  batch.liability_type === 'Loss' ? 'bg-amber-100 text-amber-700' :
                                  batch.liability_type === 'Penalty' ? 'bg-rose-100 text-rose-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {batch.liability_type}
                                </span>
                              </td>
                              <td className="py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Number(batch.amount_zar))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="p-8 bg-slate-900 rounded-3xl text-white space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gross Liability</p>
                        <p className="text-2xl font-black">{formatCurrency(totalGrossLiability)}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Discount (ZAR)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          value={discount}
                          onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Net Payable</p>
                        <p className="text-4xl font-black text-emerald-400">{formatCurrency(netPayable)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Reference</label>
                        <input 
                          type="text"
                          placeholder="E.g. EFT-2026-03-07"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          value={paymentRef}
                          onChange={e => setPaymentRef(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <button 
                          onClick={handleSettle}
                          disabled={isSubmitting || !paymentRef || batches.length === 0}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <DollarSign size={18} />}
                          PROCESS SETTLEMENT
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedSupplier ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No outstanding liability for this supplier</p>
                </div>
              ) : (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Calculator size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select a supplier to calculate liability</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <HistoryIcon size={14} className="text-blue-500" /> Recent Settlements
              </h4>
            </div>
            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {settlements.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-bold uppercase text-center py-10">No settlement history</p>
              ) : settlements.map(s => {
                const supplier = suppliers.find(sup => sup.id === s.supplier_id);
                return (
                  <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 hover:border-slate-300 transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-slate-900">{supplier?.name || 'Unknown'}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{s.created_at.split('T')[0]}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(s.net_payable)}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ref: {s.id.split('-')[0]}</span>
                       <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                         <Download size={10} /> PDF
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl flex gap-4">
            <Info className="text-emerald-600 shrink-0" size={20} />
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Financial Closure</h4>
              <p className="text-[10px] text-emerald-800 leading-relaxed font-medium">
                Processing a settlement marks all included batches as <strong>'Settled'</strong>. This stops all future accruals for those records and locks them for audit purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementModule;
