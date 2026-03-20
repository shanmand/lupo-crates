
import React, { useState, useEffect } from 'react';
import { Truck as TruckIcon, User as UserIcon, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle, Search, Filter, Calendar, MapPin, Edit2, X, Loader2, Paperclip, Eye } from 'lucide-react';
import { supabase, isSupabaseConfigured, uploadFleetDocument, getSignedFleetDocumentUrl } from '../supabase';
import { Truck, Driver, Branch } from '../types';
import BranchSelector from './BranchSelector';

const LogisticsRegistry: React.FC = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTruck, setNewTruck] = useState({
    id: '',
    plate_number: '',
    license_disc_expiry: '',
    last_renewal_cost_zar: 0,
    branch_id: ''
  });

  const [newDriver, setNewDriver] = useState({
    id: '',
    full_name: '',
    contact_number: '',
    license_number: '',
    license_expiry: '',
    prdp_expiry: '',
    branch_id: ''
  });

  const [truckPage, setTruckPage] = useState(0);
  const [driverPage, setDriverPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      // Implement server-side pagination and search
      let truckQuery = supabase.from('trucks').select('*', { count: 'exact' });
      let driverQuery = supabase.from('drivers').select('*', { count: 'exact' });

      if (searchQuery) {
        truckQuery = truckQuery.ilike('plate_number', `%${searchQuery}%`);
        driverQuery = driverQuery.ilike('full_name', `%${searchQuery}%`);
      }

      const [trucksRes, driversRes, branchesRes] = await Promise.all([
        truckQuery.range(truckPage * PAGE_SIZE, (truckPage + 1) * PAGE_SIZE - 1),
        driverQuery.range(driverPage * PAGE_SIZE, (driverPage + 1) * PAGE_SIZE - 1),
        supabase.from('branches').select('*').order('name')
      ]);

      if (trucksRes.error) console.log("Supabase Fetch Trucks Error:", trucksRes.error);
      if (driversRes.error) console.log("Supabase Fetch Drivers Error:", driversRes.error);
      if (branchesRes.error) console.log("Supabase Fetch Branches Error:", branchesRes.error);

      if (trucksRes.data) setTrucks(trucksRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [truckPage, driverPage, searchQuery]);

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const id = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('trucks').insert([{ ...newTruck, id }]);
      if (error) {
        console.log("Supabase Insert Truck Error:", error);
        throw error;
      }
      setNotification({ msg: `Truck ${newTruck.plate_number} registered`, type: 'success' });
      setIsAddingTruck(false);
      setNewTruck({ id: '', plate_number: '', license_disc_expiry: '', last_renewal_cost_zar: 0, branch_id: '' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to register truck", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const id = `DRV-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('drivers').insert([{ ...newDriver, id }]);
      if (error) {
        console.log("Supabase Insert Driver Error:", error);
        throw error;
      }
      setNotification({ msg: `Driver ${newDriver.full_name} registered`, type: 'success' });
      setIsAddingDriver(false);
      setNewDriver({ id: '', full_name: '', contact_number: '', license_number: '', license_expiry: '', prdp_expiry: '', branch_id: '' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to register driver", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'truck' | 'driver') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const entity = type === 'truck' ? editingTruck : editingDriver;
    if (!entity) return;

    setIsUploading(true);
    try {
      const fileName = type === 'truck' ? 'license_disc' : 'driver_license';
      const path = await uploadFleetDocument(file, entity.branch_id || 'unassigned', entity.id, fileName);
      
      const { error } = await supabase
        .from(type === 'truck' ? 'trucks' : 'drivers')
        .update({ license_doc_url: path })
        .eq('id', entity.id);

      if (error) {
        console.log("Supabase Update Document Error:", error);
        throw error;
      }

      if (type === 'truck') {
        setEditingTruck({ ...editingTruck!, license_doc_url: path });
      } else {
        setEditingDriver({ ...editingDriver!, license_doc_url: path });
      }

      setNotification({ msg: "Document uploaded successfully", type: 'success' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Upload failed", type: 'error' });
    } finally {
      setIsUploading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleViewDocument = async (path: string) => {
    try {
      const url = await getSignedFleetDocumentUrl(path);
      window.open(url, '_blank');
    } catch (err: any) {
      alert("Error generating document link: " + err.message);
    }
  };

  const handleUpdateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('trucks')
        .update({
          plate_number: editingTruck.plate_number,
          license_disc_expiry: editingTruck.license_disc_expiry,
          last_renewal_cost_zar: editingTruck.last_renewal_cost_zar,
          branch_id: editingTruck.branch_id
        })
        .eq('id', editingTruck.id);
      if (error) {
        console.log("Supabase Update Truck Error:", error);
        throw error;
      }
      setNotification({ msg: `Truck ${editingTruck.plate_number} updated`, type: 'success' });
      setEditingTruck(null);
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to update truck", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          full_name: editingDriver.full_name,
          contact_number: editingDriver.contact_number,
          license_number: editingDriver.license_number,
          license_expiry: editingDriver.license_expiry,
          prdp_expiry: editingDriver.prdp_expiry,
          branch_id: editingDriver.branch_id
        })
        .eq('id', editingDriver.id);
      if (error) {
        console.log("Supabase Update Driver Error:", error);
        throw error;
      }
      setNotification({ msg: `Driver ${editingDriver.full_name} updated`, type: 'success' });
      setEditingDriver(null);
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to update driver", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (!confirm("Decommission this truck?")) return;
    try {
      const { error } = await supabase.from('trucks').delete().eq('id', id);
      if (error) {
        console.log("Supabase Delete Truck Error:", error);
        throw error;
      }
      fetchData();
    } catch (err) {
      alert("Error deleting truck");
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm("Remove this driver?")) return;
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) {
        console.log("Supabase Delete Driver Error:", error);
        throw error;
      }
      fetchData();
    } catch (err) {
      alert("Error deleting driver");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Logistics Registry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Fleet & Driver Management</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search fleet/drivers..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAddingTruck(true)} className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-200 transition-all">
              <TruckIcon size={18} /> ADD TRUCK
            </button>
            <button onClick={() => setIsAddingDriver(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
              <UserIcon size={18} /> ADD DRIVER
            </button>
          </div>
        </div>
      </div>

      {/* Forms */}
      {isAddingTruck && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95">
          <h4 className="font-black text-sm uppercase tracking-widest mb-6">Register New Truck</h4>
          <form onSubmit={handleAddTruck} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plate Number</label>
              <input 
                required
                placeholder="e.g. CA 123-456"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newTruck.plate_number}
                onChange={e => setNewTruck({...newTruck, plate_number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Disc Expiry</label>
              <input 
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newTruck.license_disc_expiry}
                onChange={e => setNewTruck({...newTruck, license_disc_expiry: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignment</label>
              <BranchSelector 
                value={newTruck.branch_id}
                onChange={val => setNewTruck({...newTruck, branch_id: val})}
                placeholder="Select Branch..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Renewal Cost (ZAR)</label>
              <input 
                type="number"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newTruck.last_renewal_cost_zar}
                onChange={e => setNewTruck({...newTruck, last_renewal_cost_zar: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="md:col-span-3 flex gap-2 pt-2">
              <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs">SAVE TRUCK</button>
              <button type="button" onClick={() => setIsAddingTruck(false)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs">CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {isAddingDriver && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95">
          <h4 className="font-black text-sm uppercase tracking-widest mb-6">Register New Driver</h4>
          <form onSubmit={handleAddDriver} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
              <input 
                required
                placeholder="Full Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newDriver.full_name}
                onChange={e => setNewDriver({...newDriver, full_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Number</label>
              <input 
                placeholder="Contact Number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newDriver.contact_number}
                onChange={e => setNewDriver({...newDriver, contact_number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Number</label>
              <input 
                placeholder="License Number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newDriver.license_number}
                onChange={e => setNewDriver({...newDriver, license_number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Expiry</label>
              <input 
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newDriver.license_expiry}
                onChange={e => setNewDriver({...newDriver, license_expiry: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PrDP Expiry</label>
              <input 
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newDriver.prdp_expiry}
                onChange={e => setNewDriver({...newDriver, prdp_expiry: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignment</label>
              <BranchSelector 
                value={newDriver.branch_id}
                onChange={val => setNewDriver({...newDriver, branch_id: val})}
                placeholder="Select Branch..."
              />
            </div>
            <div className="lg:col-span-3 flex gap-2 pt-2">
              <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs">SAVE DRIVER</button>
              <button type="button" onClick={() => setIsAddingDriver(false)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs">CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trucks List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Fleet (Trucks)</h4>
            <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400">{trucks.length} Units</span>
          </div>
          <div className="divide-y divide-slate-50">
            {trucks.map(t => (
              <div key={`truck-${t.id}`} className="px-8 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors">
                    <TruckIcon size={20} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-none">{t.plate_number}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                      <MapPin size={10} /> {branches.find(b => b.id === t.branch_id)?.name || 'Unassigned'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingTruck(t)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Edit2 size={18} /></button>
                  <button onClick={() => handleDeleteTruck(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
            {trucks.length === 0 && <div className="p-12 text-center text-slate-300 italic text-sm">No trucks registered</div>}
          </div>
        </div>

        {/* Drivers List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Drivers</h4>
            <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400">{drivers.length} Active</span>
          </div>
          <div className="divide-y divide-slate-50">
            {drivers.map(d => (
              <div key={`driver-${d.id}`} className="px-8 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-none">{d.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                      <MapPin size={10} /> {branches.find(b => b.id === d.branch_id)?.name || 'Unassigned'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingDriver(d)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Edit2 size={18} /></button>
                  <button onClick={() => handleDeleteDriver(d.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
            {drivers.length === 0 && <div className="p-12 text-center text-slate-300 italic text-sm">No drivers registered</div>}
          </div>
        </div>
      </div>

      {/* Edit Truck Modal */}
      {editingTruck && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">Edit Truck</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Update Fleet Information</p>
              </div>
              <button onClick={() => setEditingTruck(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateTruck} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plate Number</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingTruck.plate_number}
                  onChange={e => setEditingTruck({...editingTruck, plate_number: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Disc Expiry</label>
                <input 
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingTruck.license_disc_expiry || ''}
                  onChange={e => setEditingTruck({...editingTruck, license_disc_expiry: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Renewal Cost (ZAR)</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingTruck.last_renewal_cost_zar || 0}
                  onChange={e => setEditingTruck({...editingTruck, last_renewal_cost_zar: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignment</label>
                <BranchSelector 
                  value={editingTruck.branch_id}
                  onChange={val => setEditingTruck({...editingTruck, branch_id: val})}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Document (PDF/Image)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-900 transition-all">
                    {isUploading ? <Loader2 className="animate-spin text-slate-400" size={20} /> : <Paperclip className="text-slate-400" size={20} />}
                    <span className="text-xs font-bold text-slate-500">{editingTruck.license_doc_url ? 'Update Document' : 'Upload License Disc'}</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload(e, 'truck')} disabled={isUploading} />
                  </label>
                  {editingTruck.license_doc_url && (
                    <button 
                      type="button"
                      onClick={() => handleViewDocument(editingTruck.license_doc_url!)}
                      className="p-4 bg-slate-100 text-slate-900 rounded-xl hover:bg-slate-200 transition-all"
                      title="View Current Document"
                    >
                      <Eye size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'UPDATE TRUCK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">Edit Driver</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Update Driver Information</p>
              </div>
              <button onClick={() => setEditingDriver(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateDriver} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingDriver.full_name}
                  onChange={e => setEditingDriver({...editingDriver, full_name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Number</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingDriver.contact_number || ''}
                  onChange={e => setEditingDriver({...editingDriver, contact_number: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Number</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingDriver.license_number || ''}
                  onChange={e => setEditingDriver({...editingDriver, license_number: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">License Expiry</label>
                <input 
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingDriver.license_expiry || ''}
                  onChange={e => setEditingDriver({...editingDriver, license_expiry: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PrDP Expiry</label>
                <input 
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={editingDriver.prdp_expiry || ''}
                  onChange={e => setEditingDriver({...editingDriver, prdp_expiry: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignment</label>
                <BranchSelector 
                  value={editingDriver.branch_id}
                  onChange={val => setEditingDriver({...editingDriver, branch_id: val})}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Driver License Document (PDF/Image)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-900 transition-all">
                    {isUploading ? <Loader2 className="animate-spin text-slate-400" size={20} /> : <Paperclip className="text-slate-400" size={20} />}
                    <span className="text-xs font-bold text-slate-500">{editingDriver.license_doc_url ? 'Update Document' : 'Upload License'}</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload(e, 'driver')} disabled={isUploading} />
                  </label>
                  {editingDriver.license_doc_url && (
                    <button 
                      type="button"
                      onClick={() => handleViewDocument(editingDriver.license_doc_url!)}
                      className="p-4 bg-slate-100 text-slate-900 rounded-xl hover:bg-slate-200 transition-all"
                      title="View Current Document"
                    >
                      <Eye size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'UPDATE DRIVER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsRegistry;

