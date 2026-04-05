
import React, { useState, useEffect } from 'react';
import { ClipboardCheck, AlertTriangle, Search, MapPin, Package, History, TrendingDown, Loader2, CheckCircle2, Plus, Calendar, ArrowRight, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { User, Location, AssetMaster } from '../types';

interface StockTakeModuleProps {
  currentUser: User;
}

const StockTakeModule: React.FC<StockTakeModuleProps> = ({ currentUser }) => {
  const [sources, setSources] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Reconciliation State
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [stockTakeDate, setStockTakeDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [sources, takesRes, itemsRes] = await Promise.all([
        fetchAllSources(),
        supabase.from('stock_takes').select('*').order('take_date', { ascending: false }),
        supabase.from('stock_take_items').select('*')
      ]);

      if (sources) setSources(sources);
      
      if (takesRes.data && itemsRes.data && sources) {
        const takes = takesRes.data;
        const items = itemsRes.data;
        const locations = sources;

        // Aggregate data (replicating vw_stock_take_history)
        const aggregatedHistory = takes.map(st => {
          const location = locations.find(l => l.id === st.location_id);
          const takeItems = items.filter(i => i.stock_take_id === st.id);
          const totalVariance = takeItems.reduce((sum, i) => sum + Math.abs(i.variance || 0), 0);

          return {
            ...st,
            location_name: location?.name || 'Unknown Location',
            item_count: takeItems.length,
            total_variance: totalVariance
          };
        });

        setHistory(aggregatedHistory);
      }
    } catch (error) {
      console.error('Error fetching stock take data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
        .select(`
          *,
          asset:asset_master(name)
        `)
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

  const handleSubmit = async () => {
    if (!selectedLocation || !isSupabaseConfigured || isSubmitting) return;

    const items = batches.map(b => ({
      batch_id: b.id,
      physical_count: physicalCounts[b.id] ?? b.quantity,
      comments: itemComments[b.id] || ''
    }));

    const hasVariances = items.some(i => {
      const batch = batches.find(b => b.id === i.batch_id);
      return i.physical_count !== batch.quantity;
    });

    setIsSubmitting(true);
    try {
      // Client-side logic for process_stock_take
      // 1. Record the stock take
      const { data: stockTakeData, error: takeError } = await supabase
        .from('stock_takes')
        .insert([{
          location_id: selectedLocation,
          performed_by: currentUser.id,
          take_date: stockTakeDate,
          counter_name: currentUser.name,
          notes: notes,
          status: hasVariances ? 'Pending Approval' : 'Approved'
        }])
        .select()
        .single();

      if (takeError) throw takeError;
      const v_stock_take_id = stockTakeData.id;

      // 2. Process each item
      for (const item of items) {
        const batch = batches.find(b => b.id === item.batch_id);
        if (!batch) continue;

        const v_system_qty = batch.quantity;
        const v_variance = item.physical_count - v_system_qty;

        // Record item
        const { error: itemError } = await supabase
          .from('stock_take_items')
          .insert([{
            stock_take_id: v_stock_take_id,
            batch_id: item.batch_id,
            system_quantity: v_system_qty,
            physical_count: item.physical_count,
            variance: v_variance,
            comments: item.comments
          }]);

        if (itemError) throw itemError;

        // If approved, update batch quantity immediately
        if (!hasVariances && v_variance !== 0) {
          const { error: updateError } = await supabase
            .from('batches')
            .update({ quantity: item.physical_count })
            .eq('id', item.batch_id);

          if (updateError) throw updateError;

          // Record adjustment movement
          await supabase.from('batch_movements').insert([{
            batch_id: item.batch_id,
            from_location_id: selectedLocation,
            to_location_id: 'ADJUSTMENT',
            quantity: v_variance,
            transaction_date: stockTakeDate,
            condition: 'Clean',
            notes: `Stock take adjustment: ${item.comments}`
          }]);
        }
      }

      setNotification({ 
        message: hasVariances ? `Stock take submitted for approval. ID: ${v_stock_take_id}` : `Stock take processed successfully.`, 
        type: 'success' 
      });
      
      setSelectedLocation('');
      setNotes('');
      setPhysicalCounts({});
      setItemComments({});
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to process stock take', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Stock Take</h1>
          <p className="text-slate-500 font-medium">Audit and reconcile physical inventory</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('reconcile')}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'reconcile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            NEW AUDIT
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            HISTORY
          </button>
        </div>
      </div>

      {activeTab === 'reconcile' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
                <ClipboardCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest">Reconciliation Terminal</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Select location to begin physical count</p>
              </div>
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-white"
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
              >
                <option value="">Select Audit Node...</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </div>
          </div>

          <div className="p-8">
            {!selectedLocation ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Search size={32} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select a location to start</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Package size={32} />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No active inventory at this location</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={stockTakeDate}
                      onChange={e => setStockTakeDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Counter Name</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={currentUser.name}
                      readOnly
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Qty</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Count</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {batches.map(batch => {
                        const physical = physicalCounts[batch.id] ?? batch.quantity;
                        const variance = physical - batch.quantity;
                        return (
                          <tr key={batch.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 font-black text-slate-900 text-sm">{batch.id}</td>
                            <td className="py-4 text-xs font-bold text-slate-600">{batch.asset?.name}</td>
                            <td className="py-4 text-sm font-black text-slate-900">{batch.quantity}</td>
                            <td className="py-4">
                              <input 
                                type="number"
                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                                value={physicalCounts[batch.id] ?? ''}
                                onChange={e => handleCountChange(batch.id, e.target.value)}
                              />
                            </td>
                            <td className="py-4">
                              <span className={`text-sm font-black ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {variance > 0 ? `+${variance}` : variance}
                              </span>
                            </td>
                            <td className="py-4">
                              <input 
                                type="text"
                                placeholder="Add comment..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
                                value={itemComments[batch.id] || ''}
                                onChange={e => setItemComments({...itemComments, [batch.id]: e.target.value})}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">General Audit Notes</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 h-24 resize-none"
                    placeholder="Describe the audit conditions..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-3 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      Submit Audit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {history.map(take => (
            <div key={take.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
              <div className="p-6 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{take.location_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(take.take_date).toLocaleDateString()} • By {take.counter_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{take.item_count} Items</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audited</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${take.total_variance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {take.total_variance} Units
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${take.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {take.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockTakeModule;
