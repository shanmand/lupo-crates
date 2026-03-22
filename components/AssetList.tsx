
import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, Loader2, CheckCircle2, AlertCircle, Trash2, Edit2, Database, Shield, CreditCard, History } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { AssetMaster, User } from '../types';

interface AssetListProps {
  currentUser: User;
}

const AssetList: React.FC<AssetListProps> = ({ currentUser }) => {
  const [assetTypes, setAssetTypes] = useState<AssetMaster[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registry' | 'types'>('registry');
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Add Type Form State
  const [typeForm, setTypeForm] = useState({
    id: '',
    name: '',
    type: 'Crate',
    dimensions: '',
    material: '',
    ownership_type: 'Internal'
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [typesRes, regRes] = await Promise.all([
        supabase.from('asset_master').select('*').order('name'),
        supabase.from('vw_asset_registry').select('*').order('created_at', { ascending: false })
      ]);

      if (typesRes.data) setAssetTypes(typesRes.data);
      if (regRes.data) setRegistry(regRes.data);
    } catch (error) {
      console.error('Error fetching asset data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('asset_master').insert([typeForm]);
      if (error) throw error;

      setNotification({ message: `Asset type ${typeForm.name} registered successfully.`, type: 'success' });
      setShowAddTypeModal(false);
      setTypeForm({ id: '', name: '', type: 'Crate', dimensions: '', material: '', ownership_type: 'Internal' });
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to register asset type', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const filteredRegistry = registry.filter(item => 
    item.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">Assets</h1>
          <p className="text-slate-500 font-medium mt-1">Master registry and asset type management</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('registry')}
            className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'registry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            REGISTRY
          </button>
          <button 
            onClick={() => setActiveTab('types')}
            className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'types' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ASSET TYPES
          </button>
        </div>
      </div>

      {activeTab === 'registry' ? (
        <div className="space-y-6">
          {/* Registry Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search registry by batch, asset, or location..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-3 text-slate-400 hover:text-slate-900 transition-colors border border-slate-100 rounded-xl">
              <Filter size={20} />
            </button>
          </div>

          {/* Registry Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Batch ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Asset Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Ownership</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Quantity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Current Location</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRegistry.map(item => (
                    <tr key={item.batch_id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <Database size={14} />
                          </div>
                          <span className="text-sm font-black text-slate-900">{item.batch_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">{item.asset_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-500">{item.asset_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.ownership_type === 'Internal' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {item.ownership_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-900">{item.quantity.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-slate-700">{item.location_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'Success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                          <History size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddTypeModal(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2"
            >
              <Plus size={16} /> Register New Type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assetTypes.map(type => (
              <div key={type.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                      <Package size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{type.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Edit2 size={14} /></button>
                    <button className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimensions</p>
                      <p className="text-xs font-bold text-slate-700">{type.dimensions || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Material</p>
                      <p className="text-xs font-bold text-slate-700">{type.material || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{type.ownership_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{type.billing_model}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Type Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={20} className="text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-widest">Register Asset Type</h3>
              </div>
              <button onClick={() => setShowAddTypeModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <CheckCircle2 size={24} />
              </button>
            </div>

            <form onSubmit={handleAddType} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Code (ID)</label>
                  <input 
                    required
                    type="text"
                    placeholder="E.g. CRT-STD"
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.id}
                    onChange={e => setTypeForm({...typeForm, id: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Name</label>
                  <input 
                    required
                    type="text"
                    placeholder="E.g. Standard Crate"
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.name}
                    onChange={e => setTypeForm({...typeForm, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.type}
                    onChange={e => setTypeForm({...typeForm, type: e.target.value})}
                  >
                    <option value="Crate">Crate</option>
                    <option value="Pallet">Pallet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ownership</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.ownership_type}
                    onChange={e => setTypeForm({...typeForm, ownership_type: e.target.value})}
                  >
                    <option value="Internal">Internal (Lupo Owned)</option>
                    <option value="External">External (CHEP/Supplier)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimensions</label>
                  <input 
                    type="text"
                    placeholder="E.g. 600x400mm"
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.dimensions}
                    onChange={e => setTypeForm({...typeForm, dimensions: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</label>
                  <input 
                    type="text"
                    placeholder="E.g. HDPE Plastic"
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    value={typeForm.material}
                    onChange={e => setTypeForm({...typeForm, material: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddTypeModal(false)}
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
                  Register Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetList;
