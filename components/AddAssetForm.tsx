import React, { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AssetMaster, AssetType, BillingModel, OwnershipType, BusinessParty } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface AddAssetFormProps {
  onClose: () => void;
  onSuccess: (asset: AssetMaster) => void;
  suppliers: BusinessParty[];
  refreshSuppliers: () => Promise<void>;
}

const AddAssetForm: React.FC<AddAssetFormProps> = ({ onClose, onSuccess, suppliers, refreshSuppliers }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newAsset, setNewAsset] = useState<Partial<AssetMaster>>({
    id: '',
    name: '',
    type: AssetType.CRATE,
    dimensions: '',
    material: '',
    billing_model: BillingModel.DAILY_RENTAL,
    ownership_type: OwnershipType.EXTERNAL,
    supplier_id: ''
  });

  const checkSupplierExists = (id: string) => {
    if (!id) return;
    // We check against locations.id (which is what supplier_id in asset_master references)
    // But the user asked to check business_parties.
    // In our app, we've been using business_parties as the source for the 'suppliers' state.
    // However, business_parties uses UUID.
    // Let's assume the user wants to check if a supplier with this 'id' (as name or mapping) exists.
    const exists = suppliers.some(s => s.name === id || s.id === id);
    setShowQuickRegister(!exists);
  };

  const handleQuickRegister = async () => {
    if (!newAsset.supplier_id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('check_and_create_supplier', { 
        p_supplier_id: newAsset.supplier_id 
      });
      if (rpcError) throw rpcError;
      
      await refreshSuppliers();
      setShowQuickRegister(false);
      alert('Supplier registered successfully!');
    } catch (err: any) {
      console.error("Quick Register Error:", err);
      setError("Failed to register supplier. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isSupabaseConfigured) {
        const { error: insertError } = await supabase
          .from('asset_master')
          .insert([newAsset]);
        
        if (insertError) {
          if (insertError.code === '23503') {
            throw new Error('Conflict: This Supplier ID needs to be registered first.');
          }
          if (insertError.code === '23505') {
            throw new Error('Conflict: An asset with this ID already exists.');
          }
          throw insertError;
        }
      }
      
      onSuccess(newAsset as AssetMaster);
      onClose();
    } catch (err: any) {
      console.error("Add Asset Error:", err);
      setError(err.message || "Failed to add asset. Check RLS policies.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 bg-slate-900 text-white">
          <h3 className="text-lg font-bold">Register New Asset Type</h3>
          <p className="text-xs text-slate-400">Define a new equipment category for the registry.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-600 text-xs font-bold">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Asset ID (e.g. CRT-01)</label>
            <input 
              required
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              value={newAsset.id}
              onChange={e => setNewAsset({...newAsset, id: e.target.value})}
              placeholder="Unique identifier"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Asset Name</label>
            <input 
              required
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              value={newAsset.name}
              onChange={e => setNewAsset({...newAsset, name: e.target.value})}
              placeholder="Common name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
              <select 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                value={newAsset.type}
                onChange={e => setNewAsset({...newAsset, type: e.target.value as any})}
              >
                <option value="Crate">Crate</option>
                <option value="Pallet">Pallet</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Material</label>
              <input 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                value={newAsset.material}
                onChange={e => setNewAsset({...newAsset, material: e.target.value})}
                placeholder="e.g. HDPE"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Dimensions</label>
            <input 
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              value={newAsset.dimensions}
              onChange={e => setNewAsset({...newAsset, dimensions: e.target.value})}
              placeholder="e.g. 600x400x150mm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Model</label>
              <select 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                value={newAsset.billing_model}
                onChange={e => setNewAsset({...newAsset, billing_model: e.target.value as any})}
              >
                {Object.values(BillingModel).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ownership</label>
              <select 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                value={newAsset.ownership_type}
                onChange={e => setNewAsset({...newAsset, ownership_type: e.target.value as any})}
              >
                {Object.values(OwnershipType).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {newAsset.ownership_type === OwnershipType.EXTERNAL && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Supplier (Owner)</label>
              <div className="relative">
                <input 
                  list="suppliers-list"
                  className={`w-full p-2 border rounded-lg text-sm transition-all ${
                    showQuickRegister ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
                  }`}
                  placeholder="Type or select supplier ID..."
                  value={newAsset.supplier_id}
                  onChange={e => {
                    setNewAsset({...newAsset, supplier_id: e.target.value});
                    setShowQuickRegister(false);
                  }}
                  onBlur={e => checkSupplierExists(e.target.value)}
                />
                <datalist id="suppliers-list">
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </datalist>
              </div>
              
              {showQuickRegister && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 text-[10px] font-bold uppercase">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Supplier ID not recognized
                  </div>
                  <button 
                    type="button"
                    onClick={handleQuickRegister}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                    Quick-Register this Supplier
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || (newAsset.ownership_type === OwnershipType.EXTERNAL && showQuickRegister)}
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Save Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default AddAssetForm;
