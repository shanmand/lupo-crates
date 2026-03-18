
import React, { useState, useEffect } from 'react';
import { MOCK_ASSETS, MOCK_FEES } from '../constants';
import { Search, Plus, Filter, MoreVertical, ShieldAlert, Loader2, Pencil, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AssetMaster, FeeSchedule, AssetType, BillingModel, OwnershipType, Location, PartnerType, BusinessParty } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import AddAssetForm from './AddAssetForm';

interface AssetListProps {
  isAdmin: boolean;
}

const AssetList: React.FC<AssetListProps> = ({ isAdmin }) => {
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [suppliers, setSuppliers] = useState<BusinessParty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setAssets(MOCK_ASSETS);
      setFees(MOCK_FEES);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [assetsRes, feesRes, suppliersRes] = await Promise.all([
        supabase.from('asset_master').select('*'),
        supabase.from('fee_schedule').select('*'),
        supabase.from('business_parties').select('*').eq('party_type', 'Supplier')
      ]);

      if (assetsRes.data) setAssets(assetsRes.data);
      if (feesRes.data) setFees(feesRes.data);
      if (suppliersRes.data) setSuppliers(suppliersRes.data);
    } catch (err) {
      console.error("Asset List Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSuppliers = async () => {
    const { data } = await supabase.from('business_parties').select('*').eq('party_type', 'Supplier');
    if (data) setSuppliers(data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetMaster | null>(null);

  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    
    // Pre-flight check
    if (editingAsset.ownership_type === OwnershipType.EXTERNAL && editingAsset.supplier_id) {
      const exists = suppliers.some(s => s.id === editingAsset.supplier_id || s.name === editingAsset.supplier_id);
      if (!exists) {
        alert('Conflict: This Supplier ID needs to be registered first.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('asset_master')
          .update({
            name: editingAsset.name,
            type: editingAsset.type,
            dimensions: editingAsset.dimensions,
            material: editingAsset.material,
            billing_model: editingAsset.billing_model,
            ownership_type: editingAsset.ownership_type,
            supplier_id: editingAsset.supplier_id
          })
          .eq('id', editingAsset.id);
        if (error) throw error;
      }
      
      setAssets(prev => prev.map(a => a.id === editingAsset.id ? editingAsset : a));
      setIsEditing(false);
      setEditingAsset(null);
    } catch (err: any) {
      console.error("Edit Asset Error:", err);
      if (err.code === '23503') {
        alert('Conflict: This Supplier ID needs to be registered first.');
      } else {
        alert("Failed to update asset.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this asset? This action cannot be undone and may fail if the asset is referenced in other records.")) return;
    
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('asset_master')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error("Delete Asset Error:", err);
      alert("Failed to delete asset. It might be in use.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search asset ID or name..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50">
            <Filter size={16} /> Filter
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg transition-all"
          >
            <Plus size={16} /> New Asset Type
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
           <ShieldAlert className="text-amber-500" size={20} />
           <p className="text-xs font-medium text-amber-800">Master Fee Rates are read-only for your profile. Changes require System Administrator clearance.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Asset Details</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Specifications</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Active Rate</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map(asset => {
              const currentFee = fees.find(f => f.asset_id === asset.id && f.effective_to === null);
              return (
                <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                        <span className="font-bold text-xs">{asset.id}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{asset.name}</p>
                        <p className="text-xs text-slate-400">{asset.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">{asset.dimensions}</p>
                    <p className="text-xs text-slate-400">{asset.material}</p>
                  </td>
                  <td className="px-6 py-4">
                    {currentFee ? (
                      <div>
                        <p className="font-bold text-slate-800">R {currentFee.amount_zar.toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase">{currentFee.fee_type}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-rose-400 italic">No rate defined</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setEditingAsset(asset); setIsEditing(true); }}
                          className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                          title="Edit Asset"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Asset"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                  No assets found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <AddAssetForm 
          onClose={() => setIsAdding(false)}
          onSuccess={(asset) => {
            setAssets(prev => [...prev, asset]);
            setIsAdding(false);
          }}
          suppliers={suppliers}
          refreshSuppliers={refreshSuppliers}
        />
      )}

      {isEditing && editingAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-amber-600 text-white">
              <h3 className="text-lg font-bold">Edit Asset: {editingAsset.id}</h3>
              <p className="text-xs text-amber-100">Update the specifications for this asset type.</p>
            </div>
            <form onSubmit={handleEditAsset} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Asset Name</label>
                <input 
                  required
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  value={editingAsset.name}
                  onChange={e => setEditingAsset({...editingAsset, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                  <select 
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    value={editingAsset.type}
                    onChange={e => setEditingAsset({...editingAsset, type: e.target.value as any})}
                  >
                    <option value="Crate">Crate</option>
                    <option value="Pallet">Pallet</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Material</label>
                  <input 
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    value={editingAsset.material}
                    onChange={e => setEditingAsset({...editingAsset, material: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Dimensions</label>
                <input 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  value={editingAsset.dimensions}
                  onChange={e => setEditingAsset({...editingAsset, dimensions: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Model</label>
                  <select 
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    value={editingAsset.billing_model}
                    onChange={e => setEditingAsset({...editingAsset, billing_model: e.target.value as any})}
                  >
                    {Object.values(BillingModel).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Ownership</label>
                  <select 
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                    value={editingAsset.ownership_type}
                    onChange={e => setEditingAsset({...editingAsset, ownership_type: e.target.value as any})}
                  >
                    {Object.values(OwnershipType).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              {editingAsset.ownership_type === OwnershipType.EXTERNAL && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Supplier (Owner)</label>
                  <div className="relative">
                    <input 
                      list="suppliers-list-edit"
                      className={`w-full p-2 border rounded-lg text-sm ${
                        editingAsset.supplier_id && !suppliers.find(s => s.id === editingAsset.supplier_id) 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-slate-200'
                      }`}
                      placeholder="Type or select supplier ID..."
                      value={editingAsset.supplier_id}
                      onChange={e => setEditingAsset({...editingAsset, supplier_id: e.target.value})}
                    />
                    <datalist id="suppliers-list-edit">
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </datalist>
                  </div>
                  {editingAsset.supplier_id && !suppliers.find(s => s.id === editingAsset.supplier_id) && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle size={10} className="text-amber-600" />
                      <p className="text-[10px] text-amber-600 font-bold">
                        Supplier ID not found. Please register the supplier in the Business Parties module first.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setIsEditing(false); setEditingAsset(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Update Asset
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
