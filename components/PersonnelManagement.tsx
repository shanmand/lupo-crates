
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Truck, 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
  X,
  MapPin,
  Phone,
  CreditCard,
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import BranchSelector from './BranchSelector';
import { Branch } from '../types';

interface Personnel {
  id: string;
  full_name: string;
  email?: string;
  role_name?: string;
  contact_number?: string;
  license_number?: string;
  branch_id: string;
  is_active: boolean;
  type: 'User' | 'Driver';
}

const PersonnelManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'User' | 'Driver'>('User');
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Personnel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role_name: 'Operator',
    contact_number: '',
    license_number: '',
    license_expiry: '',
    branch_id: '',
    is_active: true
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [usersRes, driversRes, branchesRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('branches').select('*').order('name')
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);

      const combined: Personnel[] = [
        ...(usersRes.data || []).map(u => ({ ...u, type: 'User' as const })),
        ...(driversRes.data || []).map(d => ({ ...d, type: 'Driver' as const }))
      ];
      
      setPersonnel(combined);
    } catch (err) {
      console.error("Personnel Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const table = activeTab === 'User' ? 'users' : 'drivers';
      
      if (isEditing && editingItem) {
        const { error } = await supabase
          .from(table)
          .update({
            full_name: formData.full_name,
            branch_id: formData.branch_id || null,
            is_active: formData.is_active,
            ...(activeTab === 'User' ? { 
              email: formData.email, 
              role_name: formData.role_name 
            } : { 
              contact_number: formData.contact_number, 
              license_number: formData.license_number,
              license_expiry: formData.license_expiry || null
            })
          })
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const id = activeTab === 'Driver' ? `DRV-${Math.floor(1000 + Math.random() * 9000)}` : crypto.randomUUID();
        const { error } = await supabase
          .from(table)
          .insert([{
            id,
            full_name: formData.full_name,
            branch_id: formData.branch_id || null,
            is_active: formData.is_active,
            ...(activeTab === 'User' ? { 
              email: formData.email, 
              role_name: formData.role_name 
            } : { 
              contact_number: formData.contact_number, 
              license_number: formData.license_number,
              license_expiry: formData.license_expiry || null
            })
          }]);
        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingItem(null);
      setFormData({
        full_name: '',
        email: '',
        role_name: 'Operator',
        contact_number: '',
        license_number: '',
        branch_id: '',
        is_active: true
      });
    } catch (err: any) {
      console.error("Personnel Save Error:", err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (item: Personnel) => {
    try {
      const table = item.type === 'User' ? 'users' : 'drivers';
      const { error } = await supabase
        .from(table)
        .update({ is_active: !item.is_active })
        .eq('id', item.id);
      if (error) throw error;
      setPersonnel(prev => prev.map(p => p.id === item.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err) {
      console.error("Toggle Status Error:", err);
    }
  };

  const handleDelete = async (item: Personnel) => {
    if (!window.confirm(`Delete ${item.full_name}?`)) return;
    try {
      const table = item.type === 'User' ? 'users' : 'drivers';
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      setPersonnel(prev => prev.filter(p => p.id !== item.id));
    } catch (err) {
      console.error("Delete Personnel Error:", err);
    }
  };

  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      const matchesTab = p.type === activeTab;
      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.email?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBranch = branchFilter === 'All' || p.branch_id === branchFilter;
      return matchesTab && matchesSearch && matchesBranch;
    });
  }, [personnel, activeTab, searchQuery, branchFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Personnel Registry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Staff, Roles & Drivers</p>
        </div>
        <button 
          onClick={() => {
            setIsEditing(false);
            setEditingItem(null);
            setFormData({
              full_name: '',
              email: '',
              role_name: 'Operator',
              contact_number: '',
              license_number: '',
              branch_id: '',
              is_active: true
            });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <Plus size={18} /> ADD {activeTab.toUpperCase()}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button 
          onClick={() => setActiveTab('User')}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'User' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={16} /> Staff & Users
        </button>
        <button 
          onClick={() => setActiveTab('Driver')}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Driver' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Truck size={16} /> Drivers
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab.toLowerCase()}s...`} 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full lg:w-64">
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
          >
            <option value="All">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name & Details</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role / ID</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredPersonnel.map(person => (
              <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${person.is_active ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {person.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{person.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                        {person.type === 'User' ? (
                          <><Mail size={10} /> {person.email}</>
                        ) : (
                          <><Phone size={10} /> {person.contact_number || 'No contact'}</>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                    <MapPin size={14} className="text-slate-400" />
                    {branches.find(b => b.id === person.branch_id)?.name || 'Unassigned'}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    {person.type === 'User' ? (
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Shield size={10} /> {person.role_name}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                        <CreditCard size={10} /> {person.id}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <button 
                      onClick={() => toggleStatus(person)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        person.is_active 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {person.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                      {person.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingItem(person);
                        setIsEditing(true);
                        setFormData({
                          full_name: person.full_name,
                          email: person.email || '',
                          role_name: person.role_name || 'Operator',
                          contact_number: person.contact_number || '',
                          license_number: person.license_number || '',
                          license_expiry: person.license_expiry || '',
                          branch_id: person.branch_id || '',
                          is_active: person.is_active
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(person)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPersonnel.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                      <Users size={32} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">No personnel found</p>
                      <p className="text-slate-400 text-[10px] font-bold mt-1">Try adjusting your search or filters</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                  {activeTab === 'User' ? <Users size={20} /> : <Truck size={20} />}
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                    {isEditing ? 'Edit' : 'Add New'} {activeTab}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Personnel Registry Entry</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  placeholder="e.g. John Doe"
                />
              </div>

              {activeTab === 'User' ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="john@shuku.co.za"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Role</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={formData.role_name}
                      onChange={e => setFormData({...formData, role_name: e.target.value})}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Number</label>
                    <input 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={formData.contact_number}
                      onChange={e => setFormData({...formData, contact_number: e.target.value})}
                      placeholder="+27 12 345 6789"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Number</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={formData.license_number}
                      onChange={e => setFormData({...formData, license_number: e.target.value})}
                      placeholder="L-123456789 (Optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Expiry</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={formData.license_expiry}
                      onChange={e => setFormData({...formData, license_expiry: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Home Branch Assignment</label>
                <BranchSelector 
                  value={formData.branch_id}
                  onChange={val => setFormData({...formData, branch_id: val})}
                  placeholder="Select Branch..."
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="is_active"
                  className="w-5 h-5 rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                />
                <label htmlFor="is_active" className="text-xs font-black text-slate-700 uppercase tracking-widest cursor-pointer">
                  Mark as Active Personnel
                </label>
              </div>
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isEditing ? 'SAVE CHANGES' : `REGISTER ${activeTab.toUpperCase()}`)}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelManagement;
