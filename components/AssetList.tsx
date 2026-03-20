
import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Loader2, Pencil, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { AssetIntelligence, User as UserType } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface AssetListProps {
  isAdmin: boolean;
}

const AssetList: React.FC<AssetListProps> = ({ isAdmin }) => {
  const [assets, setAssets] = useState<AssetIntelligence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetIntelligence | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    asset_code: '',
    asset_type: 'Crate',
    ownership: 'Owned',
    status: 'Available',
    condition: 'Good',
    customer: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('vw_asset_intelligence')
          .select('*');
        
        if (error) throw error;
        if (data) setAssets(data);
      }
    } catch (err) {
      console.error("Asset Intelligence Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-ZA', { 
      style: 'currency', 
      currency: 'ZAR',
      minimumFractionDigits: 2 
    }).format(val);

  const filteredAssets = assets.filter(a => {
    const matchesSearch = (a.asset_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                         (a.customer?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || a.asset_type === typeFilter;
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalCrates = assets.filter(a => a.asset_type === 'Crate').length;
  const totalPallets = assets.filter(a => a.asset_type === 'Pallet').length;

  const handleOpenModal = (asset?: AssetIntelligence) => {
    if (asset) {
      setEditingAsset(asset);
      setFormData({
        asset_code: asset.asset_code,
        asset_type: asset.asset_type,
        ownership: asset.ownership,
        status: asset.status,
        condition: asset.condition,
        customer: asset.customer || ''
      });
    } else {
      setEditingAsset(null);
      setFormData({
        asset_code: '',
        asset_type: 'Crate',
        ownership: 'Owned',
        status: 'Available',
        condition: 'Good',
        customer: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        if (editingAsset) {
          // Update logic (mapping to asset_master or similar)
          const { error } = await supabase
            .from('asset_master')
            .update({
              type: formData.asset_type,
              ownership_type: formData.ownership,
              // Add other fields as they map to your schema
            })
            .eq('id', formData.asset_code);
          if (error) throw error;
        } else {
          // Insert logic
          const { error } = await supabase
            .from('asset_master')
            .insert([{
              id: formData.asset_code,
              type: formData.asset_type,
              ownership_type: formData.ownership,
              // Add other fields
            }]);
          if (error) throw error;
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Submit Asset Error:", err);
      alert("Failed to save asset. Please check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (assetCode: string) => {
    if (!window.confirm(`Are you sure you want to decommission asset ${assetCode}?`)) return;
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('asset_master')
          .delete()
          .eq('id', assetCode);
        if (error) throw error;
      }
      fetchData();
    } catch (err) {
      console.error("Delete Asset Error:", err);
      alert("Failed to delete asset.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-emerald-500 mx-auto" size={48} />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Loading Asset Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 bg-white min-h-screen">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-950 p-10 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="relative z-10">
            <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Fleet Inventory</p>
            <h3 className="text-sm font-bold text-emerald-400 mt-1">TOTAL CRATES</h3>
            <h4 className="text-6xl font-black mt-2 tracking-tighter">{totalCrates}</h4>
          </div>
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 relative z-10">
            <Plus className="text-emerald-500" size={40} />
          </div>
        </div>
        <div className="bg-slate-950 p-10 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/20 transition-all" />
          <div className="relative z-10">
            <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Fleet Inventory</p>
            <h3 className="text-sm font-bold text-blue-400 mt-1">TOTAL PALLETS</h3>
            <h4 className="text-6xl font-black mt-2 tracking-tighter">{totalPallets}</h4>
          </div>
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 relative z-10">
            <Plus className="text-blue-500" size={40} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row flex-1 gap-4 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search Asset Code or Customer..." 
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold text-slate-900"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <select 
              className="px-6 py-4 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Crate">Crates</option>
              <option value="Pallet">Pallets</option>
            </select>
            <select 
              className="px-6 py-4 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="At Customer">At Customer</option>
              <option value="In Transit">In Transit</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="w-full lg:w-auto px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
          >
            <Plus size={18} /> Add Asset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Code</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Ownership</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Condition</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Charge Type</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Accrued</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6 font-black text-slate-900 text-sm tracking-tight">{asset.asset_code}</td>
                  <td className="px-8 py-6 text-xs font-bold text-slate-600 uppercase tracking-wider">{asset.asset_type}</td>
                  <td className="px-8 py-6 text-xs text-slate-500 font-medium">{asset.ownership}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      asset.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600' :
                      asset.status === 'At Customer' ? 'bg-blue-500/10 text-blue-600' :
                      asset.status === 'In Transit' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-rose-500/10 text-rose-600'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-xs text-slate-500 font-bold">{asset.condition}</td>
                  <td className="px-8 py-6 text-xs font-black text-slate-800 uppercase tracking-tight">{asset.customer || '—'}</td>
                  <td className="px-8 py-6 text-xs text-slate-500 font-medium italic">{asset.charge_type}</td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 text-sm tabular-nums">{formatCurrency(asset.accrued)}</td>
                  <td className="px-8 py-6 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={() => handleOpenModal(asset)}
                          className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm hover:shadow-emerald-100"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(asset.asset_code)}
                          className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm hover:shadow-rose-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-2 opacity-20">
                      <Search className="mx-auto" size={48} />
                      <p className="text-slate-900 font-black uppercase tracking-widest text-xs">No matching assets found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in duration-300 my-auto">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-3xl font-black tracking-tighter">{editingAsset ? 'EDIT ASSET' : 'REGISTER ASSET'}</h3>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-1">Global Asset Intelligence Registry</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors relative z-10">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identifier</label>
                  <input 
                    required
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                    value={formData.asset_code}
                    onChange={e => setFormData({...formData, asset_code: e.target.value})}
                    placeholder="e.g. CRT-1001"
                    disabled={!!editingAsset}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Equipment Type</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                    value={formData.asset_type}
                    onChange={e => setFormData({...formData, asset_type: e.target.value})}
                  >
                    <option value="Crate">Crate (Standard)</option>
                    <option value="Pallet">Pallet (Standard)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ownership Model</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                    value={formData.ownership}
                    onChange={e => setFormData({...formData, ownership: e.target.value})}
                  >
                    <option value="Owned">Owned (Internal)</option>
                    <option value="Leased">Leased (External)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Available">Available</option>
                    <option value="At Customer">At Customer</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Condition</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                    value={formData.condition}
                    onChange={e => setFormData({...formData, condition: e.target.value})}
                  >
                    <option value="Good">Good / Operational</option>
                    <option value="Damaged">Damaged / Repair Required</option>
                    <option value="Lost">Lost / Missing</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Holder</label>
                  <input 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                    value={formData.customer}
                    onChange={e => setFormData({...formData, customer: e.target.value})}
                    placeholder="Customer Name or ID"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-8">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 border-2 border-slate-100 text-slate-500 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95"
                >
                  Discard Changes
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-5 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all shadow-2xl shadow-slate-950/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  {editingAsset ? 'Update Intelligence' : 'Register Asset'}
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
