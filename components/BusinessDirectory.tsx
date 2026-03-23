import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Building2, 
  Users, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2,
  MoreVertical,
  Briefcase,
  Package,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { BusinessDirectoryEntry } from '../types';
import { AddressAutocomplete } from './AddressAutocomplete';

const BusinessDirectory: React.FC = () => {
  const [partners, setPartners] = useState<BusinessDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessDirectoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPartner, setNewPartner] = useState({
    id: '',
    name: '',
    party_type: 'Supplier',
    address: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        console.log("Fetching business directory data...");
        const { data, error } = await supabase
          .from('vw_business_directory')
          .select('*');
        
        if (error) {
          console.error("Supabase error fetching directory:", error);
          throw error;
        }
        
        console.log(`Fetched ${data?.length || 0} partners`);
        if (data) setPartners(data);
      } else {
        // Mock data for development
        setPartners([
          { id: 'SUP-CHEP-001', name: 'CHEP South Africa', party_type: 'Supplier', asset_types: 2, current_stock: 4500 },
          { id: 'CUST-CH-001', name: 'Checkers Hyper', party_type: 'Customer', asset_types: 1, current_stock: 1200 },
          { id: 'SUP-PAR-002', name: 'Paragon Pallets', party_type: 'Supplier', asset_types: 1, current_stock: 800 }
        ]);
      }
    } catch (err) {
      console.error("Fetch Partners Error:", err);
      setError("Failed to load business directory. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isSupabaseConfigured) {
        // 1. Add to business_parties
        const { error: insertError } = await supabase
          .from('business_parties')
          .insert([{
            id: newPartner.id,
            name: newPartner.name,
            party_type: newPartner.party_type,
            address: newPartner.address
          }]);
        
        if (insertError) throw insertError;

        // 2. Also create a location entry for consistency if it's a Supplier or Customer
        if (['Supplier', 'Customer'].includes(newPartner.party_type)) {
          const { error: locError } = await supabase
            .from('locations')
            .upsert([{
              id: newPartner.id,
              name: newPartner.name,
              type: newPartner.party_type,
              category: 'External',
              partner_type: newPartner.party_type,
              address: newPartner.address
            }]);
          
          if (locError) {
            console.warn("Partner added but location sync failed:", locError);
            // We don't throw here as the primary record was saved
          }
        }
      }
      
      await fetchData();
      setIsAdding(false);
      setNewPartner({ id: '', name: '', party_type: 'Supplier', address: '' });
    } catch (err: any) {
      console.error("Add Partner Error:", err);
      setError(err.message || "Failed to add partner. Ensure ID is unique.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      if (isSupabaseConfigured) {
        const { error: updateError } = await supabase
          .from('business_parties')
          .update({
            name: editingPartner.name,
            party_type: editingPartner.party_type,
            address: editingPartner.address
          })
          .eq('id', editingPartner.id);
        
        if (updateError) throw updateError;

        // Sync to locations as well
        if (['Supplier', 'Customer'].includes(editingPartner.party_type)) {
          await supabase
            .from('locations')
            .upsert([{
              id: editingPartner.id,
              name: editingPartner.name,
              type: editingPartner.party_type,
              category: 'External',
              partner_type: editingPartner.party_type,
              address: editingPartner.address
            }]);
        }
      }
      
      await fetchData();
      setEditingPartner(null);
    } catch (err: any) {
      console.error("Update Partner Error:", err);
      setError(err.message || "Failed to update partner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this partner? This may affect existing records.")) return;
    
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error: deleteError } = await supabase
          .from('business_parties')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;
      }
      
      await fetchData();
    } catch (err: any) {
      console.error("Delete Partner Error:", err);
      alert(err.message || "Failed to delete partner.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPartners = partners.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = (p.name || '').toLowerCase().includes(searchLower);
    const idMatch = (p.id || '').toLowerCase().includes(searchLower);
    const matchesSearch = nameMatch || idMatch;
    const matchesType = typeFilter === 'All' || p.party_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search partners by name or ID..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
            {['All', 'Supplier', 'Customer'].map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  typeFilter === type ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type}s
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-black flex items-center gap-2 hover:bg-amber-600 shadow-lg transition-all"
          >
            <Plus size={16} /> Add Partner
          </button>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Partner Details</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Asset Types</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Current Stock</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPartners.map(partner => (
              <tr key={`partner-${partner.id}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      partner.party_type === 'Supplier' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {partner.party_type === 'Supplier' ? <Briefcase size={20} /> : <Building2 size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{partner.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{partner.id}</p>
                      {partner.address && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-1 line-clamp-1 max-w-[200px]">{partner.address}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    partner.party_type === 'Supplier' 
                      ? 'bg-amber-100 text-amber-700' 
                      : partner.party_type === 'Customer'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {partner.party_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg">
                    <Package size={12} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">{partner.asset_types || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <p className="text-sm font-black text-slate-800">{(partner.current_stock || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Units in System</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setEditingPartner(partner)}
                      className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                      title="Edit Partner"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeletePartner(partner.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Partner"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPartners.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Users className="mx-auto text-slate-200" size={48} />
                    <p className="text-slate-500 font-bold">No partners found</p>
                    <p className="text-xs text-slate-400">Try adjusting your search or filters to find what you're looking for.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Partner Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-lg font-bold">Add New Business Partner</h3>
              <p className="text-xs text-slate-400">Register a new supplier, customer, or transporter.</p>
            </div>
            
            <form onSubmit={handleAddPartner} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-600 text-xs font-bold">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner ID</label>
                <input 
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={newPartner.id}
                  onChange={e => setNewPartner({...newPartner, id: e.target.value})}
                  placeholder="e.g. SUP-CHEP-001"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Name</label>
                <input 
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={newPartner.name}
                  onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                  placeholder="Legal business name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner Type</label>
                <select 
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={newPartner.party_type}
                  onChange={e => setNewPartner({...newPartner, party_type: e.target.value})}
                >
                  <option value="Supplier">Supplier</option>
                  <option value="Customer">Customer</option>
                  <option value="Transporter">Transporter</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Address (OpenStreetMap Search)</label>
                <AddressAutocomplete 
                  value={newPartner.address || ''}
                  onChange={address => setNewPartner({...newPartner, address})}
                  placeholder="Search for address in South Africa..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Partner Modal */}
      {editingPartner && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-lg font-bold">Edit Business Partner</h3>
              <p className="text-xs text-slate-400">Update details for {editingPartner.name}</p>
            </div>
            
            <form onSubmit={handleUpdatePartner} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-600 text-xs font-bold">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner ID (Read-only)</label>
                <input 
                  disabled
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 outline-none cursor-not-allowed"
                  value={editingPartner.id}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Name</label>
                <input 
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={editingPartner.name}
                  onChange={e => setEditingPartner({...editingPartner, name: e.target.value})}
                  placeholder="Legal business name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner Type</label>
                <select 
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  value={editingPartner.party_type}
                  onChange={e => setEditingPartner({...editingPartner, party_type: e.target.value})}
                >
                  <option value="Supplier">Supplier</option>
                  <option value="Customer">Customer</option>
                  <option value="Transporter">Transporter</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Address (OpenStreetMap Search)</label>
                <AddressAutocomplete 
                  value={editingPartner.address || ''}
                  onChange={address => setEditingPartner({...editingPartner, address})}
                  placeholder="Search for address in South Africa..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-slate-900 rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Update Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDirectory;
