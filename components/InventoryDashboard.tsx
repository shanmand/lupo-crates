
import React, { useState, useEffect } from 'react';
import { Package, MapPin, TrendingUp, AlertCircle, Plus, Search, Loader2, CheckCircle2, ArrowRight, History, Download } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { User, AssetMaster, Location } from '../types';

interface InventoryDashboardProps {
  currentUser: User;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ currentUser }) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Intake Form State
  const [intakeForm, setIntakeForm] = useState({
    asset_id: '',
    quantity: 0,
    location_id: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [invRes, assetRes, sourceRes] = await Promise.all([
        supabase.from('vw_inventory_summary').select('*'),
        supabase.from('asset_master').select('*'),
        supabase.from('vw_all_sources').select('*')
      ]);

      if (invRes.data) setInventory(invRes.data);
      if (assetRes.data) setAssets(assetRes.data);
      if (sourceRes.data) setSources(sourceRes.data);
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
      const { data, error } = await supabase.rpc('process_inventory_intake', {
        p_asset_id: intakeForm.asset_id,
        p_quantity: intakeForm.quantity,
        p_location_id: intakeForm.location_id,
        p_notes: intakeForm.notes,
        p_user_id: currentUser.id
      });

      if (error) throw error;

      setNotification({ message: `Inventory intake successful. Batch ID: ${data}`, type: 'success' });
      setShowIntakeModal(false);
      setIntakeForm({ asset_id: '', quantity: 0, location_id: '', notes: '' });
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to process intake', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
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
              <p className="text-xl font-black text-slate-900">{totalUnits.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
              <History size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Batches</p>
              <p className="text-xl font-black text-slate-900">{totalBatches.toLocaleString()}</p>
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
                <p className="text-2xl font-black text-slate-900">{item.total_quantity.toLocaleString()}</p>
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

      {/* Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={20} className="text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-widest">Inventory Intake</h3>
              </div>
              <button onClick={() => setShowIntakeModal(false)} className="text-slate-400 hover:text-white transition-colors">
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
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location / Business Party</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={intakeForm.location_id}
                    onChange={e => setIntakeForm({...intakeForm, location_id: e.target.value})}
                  >
                    <option value="">Select Source...</option>
                    {sources.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </div>
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
                  onClick={() => setShowIntakeModal(false)}
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
                  Confirm Intake
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
