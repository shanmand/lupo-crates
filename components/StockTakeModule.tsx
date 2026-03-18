
import React, { useState, useEffect } from 'react';
import { ClipboardCheck, AlertTriangle, Search, MapPin, Package, History as HistoryIcon, TrendingDown, Loader2, CheckCircle2, Plus, Calendar } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { normalizePayload } from '../supabaseUtils';
import BranchSelector from './BranchSelector';
import { Batch, Location, AssetMaster, User } from '../types';

interface StockTakeModuleProps {
  currentUser: User;
  initialLocationId?: string;
}

const StockTakeModule: React.FC<StockTakeModuleProps> = ({ currentUser, initialLocationId }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocationId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'reconcile' | 'approvals'>('reconcile');
  const [pendingTakes, setPendingTakes] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [stockTakeDate, setStockTakeDate] = useState(new Date().toISOString().split('T')[0]);
  const [counterName, setCounterName] = useState(currentUser.name);
  
  // Local state for counts and comments
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [locsRes, assetsRes] = await Promise.all([
          supabase.from('vw_all_sources').select('*').order('name'),
          supabase.from('asset_master').select('*')
        ]);
        if (locsRes.data) setLocations(locsRes.data as any);
        if (assetsRes.data) setAssets(assetsRes.data);
      } catch (err) {
        console.error("StockTake Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedLocation || !isSupabaseConfigured) {
        setBatches([]);
        return;
      }
      const { data } = await supabase
        .from('batches')
        .select('*')
        .eq('current_location_id', selectedLocation)
        .eq('status', 'Success');
      
      if (data) {
        setBatches(data);
        const initialCounts: Record<string, number> = {};
        data.forEach(b => initialCounts[b.id] = b.quantity);
        setPhysicalCounts(initialCounts);
      }
    };
    fetchBatches();
  }, [selectedLocation]);

  const handleCountChange = (batchId: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value);
    setPhysicalCounts(prev => ({ ...prev, [batchId]: num }));
  };

  const handleCommentChange = (batchId: string, value: string) => {
    setItemComments(prev => ({ ...prev, [batchId]: value }));
  };

  const hasVariances = batches.some(b => (physicalCounts[b.id] ?? b.quantity) !== b.quantity);

  const handleSubmitReconciliation = async () => {
    if (!selectedLocation || !isSupabaseConfigured || isSubmitting) return;
    
    // Validation: Comments required for variances
    const invalidItems = batches.filter(b => {
      const physical = physicalCounts[b.id] ?? b.quantity;
      const variance = physical - b.quantity;
      return variance !== 0 && !itemComments[b.id]?.trim();
    });

    if (invalidItems.length > 0) {
      setNotification({ 
        message: `Please provide comments for all items with variances (Batch IDs: ${invalidItems.map(i => i.id).join(', ')})`, 
        type: 'error' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const items = batches.map(b => ({
        batch_id: String(b.id),
        physical_count: physicalCounts[b.id] ?? b.quantity,
        comments: itemComments[b.id] || ''
      }));

      // If there are variances, status is 'Pending Approval'
      // If no variances, it's 'Approved' (since no adjustments are needed)
      const status = hasVariances ? 'Pending Approval' : 'Approved';

      const { data, error } = await supabase.rpc('process_stock_take', normalizePayload({
        p_location_id: selectedLocation,
        p_performed_by: currentUser.id,
        p_take_date: stockTakeDate,
        p_counter_name: counterName,
        p_notes: notes,
        p_status: status,
        p_items: items
      }));

      if (error) throw error;

      setNotification({ 
        message: status === 'Pending Approval' 
          ? `Stock take submitted for approval. ID: ${data}` 
          : `Stock take processed successfully. ID: ${data}`, 
        type: 'success' 
      });
      setNotes('');
      setItemComments({});
      
      const { data: updatedBatches } = await supabase
        .from('batches')
        .select('*')
        .eq('current_location_id', selectedLocation)
        .eq('status', 'Success');
      if (updatedBatches) setBatches(updatedBatches);

    } catch (err: any) {
      setNotification({ message: err.message || "Failed to process stock take.", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchPendingTakes();
    }
  }, [activeTab]);

  const fetchPendingTakes = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('stock_takes')
        .select(`
          *,
          location:locations(name),
          items:stock_take_items(
            *,
            asset:asset_master(name)
          )
        `)
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingTakes(data || []);
    } catch (err) {
      console.error('Error fetching pending takes:', err);
    }
  };

  const handleApprove = async (takeId: string) => {
    try {
      const { error } = await supabase.rpc('approve_reconciliation', {
        p_stock_take_id: takeId,
        p_approved_by: currentUser.id
      });
      if (error) throw error;
      setNotification({ message: 'Stock take approved and adjustments applied.', type: 'success' });
      fetchPendingTakes();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to approve.', type: 'error' });
    }
  };

  const handleReject = async (takeId: string) => {
    try {
      const { error } = await supabase.rpc('reject_stock_take', {
        p_stock_take_id: takeId
      });
      if (error) throw error;
      setNotification({ message: 'Stock take rejected.', type: 'success' });
      fetchPendingTakes();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to reject.', type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">STOCK TAKE</h1>
          <p className="text-slate-500 font-medium">Reconcile physical inventory with system records</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('reconcile')}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'reconcile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            RECONCILE
          </button>
          <button 
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            APPROVALS
            {pendingTakes.length > 0 && (
              <span className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">
                {pendingTakes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'reconcile' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
                <ClipboardCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest">Stock Take Reconciliation</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bulk Inventory Audit & Loss Recovery</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <BranchSelector 
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  placeholder="All Branches"
                  className="bg-slate-800 border-slate-700 text-white text-xs py-2 h-auto"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-white"
                  value={selectedLocation}
                  onChange={e => setSelectedLocation(e.target.value)}
                >
                  <option value="">Select Location...</option>
                  {locations
                    .filter(l => !selectedBranch || l.branch_id === selectedBranch)
                    .map(l => <option key={l.id} value={l.id}>{l.name}</option>)
                  }
                </select>
              </div>
            </div>
          </div>

          <div className="p-8">
            {!selectedLocation ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Search size={32} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select a location to begin reconciliation</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Package size={32} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No active batches found at this location</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} /> Stock Take Date
                    </label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                      value={stockTakeDate}
                      onChange={e => setStockTakeDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <HistoryIcon size={12} /> Counter Name
                    </label>
                    <input 
                      type="text"
                      placeholder="Enter name of person counting..."
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                      value={counterName}
                      onChange={e => setCounterName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Type</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Qty</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Count</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comments</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {batches.map(batch => {
                        const asset = assets.find(a => a.id === batch.asset_id);
                        const physical = physicalCounts[batch.id] ?? batch.quantity;
                        const variance = physical - batch.quantity;
                        
                        return (
                          <tr key={batch.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                  <HistoryIcon size={14} />
                                </div>
                                <span className="text-sm font-bold text-slate-900">#{batch.id}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="text-xs font-medium text-slate-600">{asset?.name || 'Unknown Asset'}</span>
                            </td>
                            <td className="py-4">
                              <span className="text-sm font-black text-slate-900">{batch.quantity}</span>
                            </td>
                            <td className="py-4">
                              <input 
                                type="number"
                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                value={physicalCounts[batch.id] ?? ''}
                                onChange={e => handleCountChange(batch.id, e.target.value)}
                              />
                            </td>
                            <td className="py-4">
                              <div className={`flex items-center gap-2 text-sm font-black ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {variance > 0 && <Plus size={12} />}
                                {variance}
                              </div>
                            </td>
                            <td className="py-4">
                              <input 
                                type="text"
                                placeholder="Reason for variance..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                value={itemComments[batch.id] || ''}
                                onChange={e => handleCommentChange(batch.id, e.target.value)}
                              />
                            </td>
                            <td className="py-4 text-right">
                              {variance < 0 ? (
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                  <TrendingDown size={14} /> Loss Detected
                                </span>
                              ) : variance > 0 ? (
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                  <Plus size={14} /> Surplus
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end">
                                  <CheckCircle2 size={14} /> Balanced
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Take Notes / Audit Comments</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all min-h-[100px]"
                      placeholder="E.g. Monthly audit performed by J. Doe. Identified 5 missing crates due to warehouse breakage."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleSubmitReconciliation}
                      disabled={isSubmitting}
                      className={`px-8 py-4 ${hasVariances ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'} text-white font-black rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-50`}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      {hasVariances ? 'SUBMIT FOR APPROVAL' : 'SUBMIT RECONCILIATION'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingTakes.length === 0 ? (
            <div className="bg-white rounded-[32px] p-20 text-center border border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-slate-300" size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">All Clear!</h3>
              <p className="text-slate-500">There are no pending stock take approvals at the moment.</p>
            </div>
          ) : (
            pendingTakes.map(take => (
              <div key={take.id} className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-sm">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Stock Take #{take.id.slice(0, 8)}</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {take.location?.name} • {new Date(take.take_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleReject(take.id)}
                      className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-black transition-all"
                    >
                      REJECT
                    </button>
                    <button 
                      onClick={() => handleApprove(take.id)}
                      className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-black transition-all shadow-lg shadow-slate-200"
                    >
                      APPROVE & ADJUST
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Counter</p>
                      <p className="text-sm font-bold text-slate-900">{take.counter_name}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl md:col-span-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                      <p className="text-sm font-medium text-slate-600">{take.notes || 'No notes provided.'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Variances to Approve</p>
                    {take.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${item.variance > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.asset?.name}</p>
                            <p className="text-[10px] font-medium text-slate-500">Batch #{item.batch_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</p>
                            <p className={`text-sm font-black ${item.variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {item.variance > 0 ? `-${item.variance}` : `+${Math.abs(item.variance)}`}
                            </p>
                          </div>
                          <div className="min-w-[200px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comment</p>
                            <p className="text-xs font-medium text-slate-600 italic">"{item.comments || 'No comment'}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 p-8 rounded-3xl flex gap-6">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Reconciliation Protocol</h4>
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            Submitting this reconciliation will atomically update system quantities. Any <strong>Losses</strong> identified will automatically trigger the creation of <strong>Asset Loss Records</strong> and apply the current <strong>Replacement Fees</strong> from the fee schedule. This action is permanent and recorded in the branch audit trail.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockTakeModule;
