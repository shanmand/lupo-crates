
import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, CheckCircle2, AlertTriangle, Search, Filter, Database, ArrowDownToLine, Edit2, Trash2, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import BranchSelector from './BranchSelector';
import { Batch, AssetMaster, AllSource } from '../types';
import { castId, normalizePayload } from '../supabaseUtils';

const BatchManagement: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [sources, setSources] = useState<AllSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editForm, setEditForm] = useState({ quantity: 0, transaction_date: '' });
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const [newBatch, setNewBatch] = useState({
    id: '',
    asset_id: '',
    quantity: 0,
    current_location_id: '',
    status: 'Success',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const [batchesRes, assetsRes, sourcesData] = await Promise.all([
        supabase.from('batches').select('*').order('created_at', { ascending: false }),
        supabase.from('asset_master').select('*').order('name'),
        fetchAllSources()
      ]);

      if (batchesRes.data) setBatches(batchesRes.data);
      if (assetsRes.data) {
        setAssets(assetsRes.data);
        if (assetsRes.data.length > 0 && !newBatch.asset_id) {
          setNewBatch(prev => ({ ...prev, asset_id: assetsRes.data[0].id }));
        }
      }
      
      setSources(sourcesData);
      if (sourcesData.length > 0 && !newBatch.current_location_id) {
        setNewBatch(prev => ({ ...prev, current_location_id: sourcesData[0].id }));
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.asset_id) {
      setNotification({ msg: "Please select an asset type", type: 'error' });
      return;
    }
    if (!newBatch.current_location_id) {
      setNotification({ msg: "Please select an initial location", type: 'error' });
      return;
    }
    if (newBatch.quantity <= 0) {
      setNotification({ msg: "Quantity must be greater than 0", type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const batchId = newBatch.id.trim() || `B-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Ensure we only pass string IDs
        const payload = normalizePayload({
          id: batchId,
          asset_id: newBatch.asset_id,
          quantity: newBatch.quantity,
          current_location_id: newBatch.current_location_id,
          status: newBatch.status,
          transaction_date: newBatch.transaction_date
        });

        const { error } = await supabase.from('batches').insert([payload]);
        if (error) throw error;
        
        setNotification({ msg: `Batch ${batchId} created successfully`, type: 'success' });
        setIsAdding(false);
        setNewBatch({
          id: '',
          asset_id: assets[0]?.id || '',
          quantity: 0,
          current_location_id: sources[0]?.id || '',
          status: 'Success',
          transaction_date: new Date().toISOString().split('T')[0]
        });
        fetchData();
      }
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to create batch", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setEditForm({
      quantity: batch.quantity,
      transaction_date: batch.transaction_date || new Date(batch.created_at).toISOString().split('T')[0]
    });
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('update_inventory_batch', normalizePayload({
        p_batch_id: editingBatch.id,
        p_quantity: editForm.quantity,
        p_date_received: editForm.transaction_date
      }));
      if (error) throw error;
      setNotification({ msg: `Batch ${editingBatch.id} updated`, type: 'success' });
      setEditingBatch(null);
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to update batch", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!confirm(`Are you sure you want to delete batch ${id}? This action cannot be undone.`)) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('delete_inventory_batch', normalizePayload({
        p_batch_id: id
      }));
      if (error) throw error;
      setNotification({ msg: `Batch ${id} deleted`, type: 'success' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to delete batch", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const filtered = batches.filter(b => 
    b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assets.find(a => a.id === b.asset_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceName = (id: string) => {
    const source = sources.find(s => s.id === id);
    return source ? source.name : id;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Intake</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Create Batches & Receive Assets</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={fetchData}
            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex-1 lg:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={18} /> NEW INVENTORY INTAKE
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Inventory Intake Form</h4>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <form onSubmit={handleAddBatch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Batch Reference ID</label>
              <input 
                placeholder="e.g. B-9001 (Auto-gen if blank)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBatch.id}
                onChange={e => setNewBatch({...newBatch, id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Type</label>
              <select 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBatch.asset_id}
                onChange={e => setNewBatch({...newBatch, asset_id: e.target.value})}
              >
                <option value="">Select Asset</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity Received</label>
              <input 
                required
                type="number"
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBatch.quantity || ''}
                onChange={e => setNewBatch({...newBatch, quantity: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Filter</label>
              <BranchSelector 
                value={selectedBranch}
                onChange={setSelectedBranch}
                placeholder="All Branches"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Source / Location</label>
              <select 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBatch.current_location_id}
                onChange={e => setNewBatch({...newBatch, current_location_id: e.target.value})}
              >
                <option value="">Select Source</option>
                {sources
                  .filter(s => !selectedBranch || !s.branch_id || s.branch_id === selectedBranch)
                  .map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)
                }
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intake Date</label>
              <input 
                required
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBatch.transaction_date}
                onChange={e => setNewBatch({...newBatch, transaction_date: e.target.value})}
              />
            </div>
            <div className="lg:col-span-4 pt-4 border-t border-slate-100">
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <ArrowDownToLine size={18} />}
                RECORD INTAKE & CREATE BATCH
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by batch ID or asset..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                <th className="px-8 py-5">Batch ID</th>
                <th className="px-8 py-5">Asset Type</th>
                <th className="px-8 py-5">Quantity</th>
                <th className="px-8 py-5">Current Location</th>
                <th className="px-8 py-5">Transaction Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(batch => (
                <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner font-black text-xs">
                         {batch.id.substring(0, 2)}
                      </div>
                      <span className="text-sm font-black text-slate-900">{batch.id}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-600">
                    {assets.find(a => a.id === batch.asset_id)?.name || 'Unknown'}
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-slate-900">
                    {batch.quantity}
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Database size={14} className="text-slate-400" />
                        {getSourceName(batch.current_location_id)}
                     </div>
                  </td>
                  <td className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase">
                    {batch.transaction_date ? new Date(batch.transaction_date).toLocaleDateString() : new Date(batch.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEditBatch(batch)}
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <p className="text-sm font-bold text-slate-400">No batches recorded in the registry.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Batch Modal */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Edit Batch {editingBatch.id}</h4>
              <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateBatch} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity Received</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editForm.quantity}
                  onChange={e => setEditForm({...editForm, quantity: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intake Date</label>
                <input 
                  required
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editForm.transaction_date}
                  onChange={e => setEditForm({...editForm, transaction_date: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                UPDATE BATCH
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManagement;
