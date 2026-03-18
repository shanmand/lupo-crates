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
  Package
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

interface BusinessPartner {
  id: string;
  name: string;
  party_type: string;
  asset_types: number;
  current_stock: number;
}

const BusinessDirectory: React.FC = () => {
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPartner, setNewPartner] = useState({
    id: '',
    name: '',
    party_type: 'Supplier'
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('vw_business_directory')
          .select('*');
        
        if (error) throw error;
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
        const { error: insertError } = await supabase
          .from('business_parties')
          .insert([newPartner]);
        
        if (insertError) throw insertError;
      }
      
      await fetchData();
      setIsAdding(false);
      setNewPartner({ id: '', name: '', party_type: 'Supplier' });
    } catch (err: any) {
      console.error("Add Partner Error:", err);
      setError(err.message || "Failed to add partner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchTerm.toLowerCase());
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
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <MoreVertical size={18} />
                  </button>
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
    </div>
  );
};

export default BusinessDirectory;
