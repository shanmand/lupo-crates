
import React, { useState, useEffect } from 'react';
import { Package, MapPin, TrendingUp, AlertCircle, Plus, Search, Loader2, CheckCircle2, ArrowRight, History, Download } from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { User, AssetMaster, Location } from '../types';
import { formatNumber } from '../constants';

interface InventoryDashboardProps {
  currentUser: User;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ currentUser }) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [recentIntakes, setRecentIntakes] = useState<any[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingIntake, setEditingIntake] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Intake Form State
  const [intakeForm, setIntakeForm] = useState({
    asset_id: '',
    quantity: 0,
    location_id: '',
    origin_id: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [batchesRes, assetRes, claimsRes, sourcesData] = await Promise.all([
        supabase.from('batches').select('*'),
        supabase.from('asset_master').select('*'),
        supabase.from('claims').select('*'),
        fetchAllSources()
      ]);

      if (batchesRes.error) throw batchesRes.error;
      if (assetRes.error) throw assetRes.error;

      const batches = batchesRes.data || [];
      const assetsData = assetRes.data || [];
      const claimsData = claimsRes.data || [];
      const uniqueAssetsMap = new Map();
      assetsData.forEach(a => {
        if (!uniqueAssetsMap.has(a.id)) {
          uniqueAssetsMap.set(a.id, a);
        }
      });
      const uniqueAssets = Array.from(uniqueAssetsMap.values());

      setAssets(uniqueAssets);
      setSources(sourcesData);

      // Aggregate Inventory Summary
      const summaryMap = new Map();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      batches
        .filter(b => b.status === 'Success' && b.quantity > 0)
        .filter(b => {
          // QSR Exclusion Logic: Exclude confirmed customer transfers from previous months
          if (b.transfer_confirmed_by_customer && b.confirmation_date) {
            const loc = sourcesData.find(s => s.id === b.current_location_id);
            if (loc?.partner_type === 'Customer') {
              const confDate = new Date(b.confirmation_date);
              if (confDate.getMonth() !== currentMonth || confDate.getFullYear() !== currentYear) {
                return false;
              }
            }
          }
          return true;
        })
        .forEach(b => {
          const key = `${b.current_location_id}-${b.asset_id}`;
          const loc = sourcesData.find(s => s.id === b.current_location_id);
          const asset = assetsData.find(a => a.id === b.asset_id);
          
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              location_id: b.current_location_id,
              location_name: loc?.name || 'Unknown Location',
              location_type: loc?.type || 'Unknown',
              branch_id: loc?.branch_id,
              asset_id: b.asset_id,
              asset_name: asset?.name || 'Unknown Asset',
              asset_type: asset?.type,
              total_quantity: 0,
              batch_count: 0
            });
          }
          
          const entry = summaryMap.get(key);
          entry.total_quantity += (b.quantity || 0);
          entry.batch_count += 1;
        });
      
      setInventory(Array.from(summaryMap.values()));

      // Map Recent Intakes
      const recent = batches
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(b => {
          const asset = assetsData.find(a => a.id === b.asset_id);
          const toLoc = sourcesData.find(s => s.id === b.current_location_id);
          const fromLoc = sourcesData.find(s => s.id === b.origin_location_id);
          const hasClaim = claimsData.some(c => c.batch_id === b.id);
          
          return {
            batch_id: b.id,
            asset_id: b.asset_id,
            asset_name: asset?.name || 'Unknown Asset',
            quantity: b.quantity,
            to_location_id: b.current_location_id,
            to_location_name: toLoc?.name || 'Unknown',
            from_location_id: b.origin_location_id,
            from_location_name: fromLoc?.name || 'Direct Intake',
            created_at: b.created_at,
            notes: b.notes,
            has_claim: hasClaim
          };
        });
      
      setRecentIntakes(recent);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingIntake) {
        // Update batch
        const { error: batchError } = await supabase
          .from('batches')
          .update({
            asset_id: intakeForm.asset_id,
            quantity: intakeForm.quantity,
            current_location_id: intakeForm.location_id
          })
          .eq('id', editingIntake.batch_id);
        
        if (batchError) throw batchError;

        // Update movement
        const { error: moveError } = await supabase
          .from('batch_movements')
          .update({
            from_location_id: intakeForm.origin_id,
            to_location_id: intakeForm.location_id,
            quantity: intakeForm.quantity,
            notes: intakeForm.notes
          })
          .eq('batch_id', editingIntake.batch_id)
          .eq('condition', 'New/Intake');
        
        if (moveError) throw moveError;

        setNotification({ message: 'Inventory intake updated successfully', type: 'success' });
      } else {
        // Generate Batch ID
        const batchId = `BAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000000)}`;
        
        // Insert Batch
        const { error: batchError } = await supabase
          .from('batches')
          .insert([{
            id: batchId,
            asset_id: intakeForm.asset_id,
            quantity: intakeForm.quantity,
            current_location_id: intakeForm.location_id,
            status: 'Success',
            transaction_date: new Date().toISOString().slice(0, 10)
          }]);
        
        if (batchError) throw batchError;

        // Insert Movement
        const { error: moveError } = await supabase
          .from('batch_movements')
          .insert([{
            batch_id: batchId,
            from_location_id: intakeForm.origin_id || null,
            to_location_id: intakeForm.location_id,
            origin_user_id: currentUser.id,
            quantity: intakeForm.quantity,
            condition: 'New/Intake',
            notes: intakeForm.notes
          }]);
        
        if (moveError) throw moveError;

        setNotification({ message: `Inventory intake successful. Batch ID: ${batchId}`, type: 'success' });
      }

      setShowIntakeModal(false);
      setEditingIntake(null);
      setIntakeForm({ asset_id: '', quantity: 0, location_id: '', origin_id: '', notes: '' });
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to process intake', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleDeleteIntake = async () => {
    if (!isSupabaseConfigured || !showDeleteConfirm) return;

    try {
      // Delete related records sequentially
      await supabase.from('batch_movements').delete().eq('batch_id', showDeleteConfirm);
      await supabase.from('asset_losses').delete().eq('batch_id', showDeleteConfirm);
      await supabase.from('claims').delete().eq('batch_id', showDeleteConfirm);
      await supabase.from('thaan_slips').delete().eq('batch_id', showDeleteConfirm);
      
      const { error } = await supabase.from('batches').delete().eq('id', showDeleteConfirm);
      if (error) throw error;

      setNotification({ message: 'Intake deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to delete intake', type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const openEditModal = (intake: any) => {
    setEditingIntake(intake);
    setIntakeForm({
      asset_id: intake.asset_id,
      quantity: intake.quantity,
      location_id: intake.to_location_id,
      origin_id: intake.from_location_id || '',
      notes: intake.notes || ''
    });
    setShowIntakeModal(true);
  };

  const filteredInventory = inventory.filter(item => 
    item.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnits = inventory.reduce((acc, curr) => acc + curr.total_quantity, 0);
  const totalBatches = inventory.reduce((acc, curr) => acc + curr.batch_count, 0);

  if (isLoading) {
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
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">Inventory</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time stock levels across all locations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assets</p>
              <p className="text-xl font-black text-slate-900">{formatNumber(totalUnits)}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
              <History size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Batches</p>
              <p className="text-xl font-black text-slate-900">{formatNumber(totalBatches)}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowIntakeModal(true)}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-3"
          >
            <Plus size={18} /> New Intake
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by location or asset type..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-3 text-slate-400 hover:text-slate-900 transition-colors">
          <Download size={20} />
        </button>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventory.map((item, idx) => (
          <div key={`${item.location_id}-${item.asset_id}-${idx}`} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.location_name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.location_type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-900">{formatNumber(item.total_quantity)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg border border-slate-100 flex items-center justify-center text-slate-400">
                  <Package size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{item.asset_name}</p>
                  <p className="text-[10px] font-medium text-slate-400">{item.batch_count} Batches</p>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Intakes Table */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Intakes</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage individual intake records</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentIntakes.map((intake) => (
                <tr key={intake.batch_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-slate-900">{new Date(intake.created_at).toLocaleDateString()}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-medium text-slate-400">{intake.batch_id}</p>
                      {intake.has_claim && (
                        <span className="bg-amber-100 text-amber-700 text-[8px] px-1 rounded font-black uppercase tracking-widest">Claim</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{intake.asset_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className="text-xs font-medium text-slate-600">{intake.from_location_name || 'Direct Intake'}</span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{intake.to_location_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className="text-sm font-black text-slate-900">{formatNumber(intake.quantity)}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(intake)}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                      >
                        <TrendingUp size={14} />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(intake.batch_id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                      >
                        <AlertCircle size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recentIntakes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <p className="text-sm font-medium text-slate-400">No recent intakes found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delete Intake?</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">
                  This will permanently remove batch <span className="font-bold text-slate-900">{showDeleteConfirm}</span> and all its movement history. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteIntake}
                  className="flex-1 bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-rose-700 transition-all uppercase tracking-widest"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={20} className="text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-widest">
                  {editingIntake ? 'Edit Intake' : 'Inventory Intake'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowIntakeModal(false);
                  setEditingIntake(null);
                  setIntakeForm({ asset_id: '', quantity: 0, location_id: '', origin_id: '', notes: '' });
                }} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <CheckCircle2 size={24} />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Type</label>
                <select 
                  required
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                  value={intakeForm.asset_id}
                  onChange={e => setIntakeForm({...intakeForm, asset_id: e.target.value})}
                >
                  <option value="">Select Asset...</option>
                  {assets.map((a, idx) => <option key={`asset-opt-${a.id}-${idx}`} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={intakeForm.quantity || ''}
                    onChange={e => setIntakeForm({...intakeForm, quantity: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={intakeForm.location_id}
                    onChange={e => setIntakeForm({...intakeForm, location_id: e.target.value})}
                  >
                    <option value="">Select Destination...</option>
                    {sources.map((s, idx) => <option key={`source-dest-opt-${s.id}-${idx}`} value={s.id}>{s.display_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin (Optional)</label>
                <select 
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                  value={intakeForm.origin_id}
                  onChange={e => setIntakeForm({...intakeForm, origin_id: e.target.value})}
                >
                  <option value="">Select Origin...</option>
                  {sources.map((s, idx) => <option key={`source-origin-opt-${s.id}-${idx}`} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Reference</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900 h-24 resize-none"
                  placeholder="E.g. Supplier delivery note #12345"
                  value={intakeForm.notes}
                  onChange={e => setIntakeForm({...intakeForm, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowIntakeModal(false);
                    setEditingIntake(null);
                    setIntakeForm({ asset_id: '', quantity: 0, location_id: '', origin_id: '', notes: '' });
                  }}
                  className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {editingIntake ? 'Update Intake' : 'Confirm Intake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryDashboard;
