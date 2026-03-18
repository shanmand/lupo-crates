
import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, AlertTriangle, Calendar, User as UserIcon, Phone, Package, ArrowRight, Clock, MapPin, Search, Filter } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { normalizePayload } from '../supabaseUtils';
import { User as UserType, UserRole, AssetMaster, MovementDestination, CollectionRequest } from '../types';

interface CollectionRequestsProps {
  currentUser: UserType;
  onAssign: (request: CollectionRequest) => void;
}

const CollectionRequests: React.FC<CollectionRequestsProps> = ({ currentUser, onAssign }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>(currentUser.role === UserRole.EXECUTIVE ? 'dashboard' : 'form');
  const [assetsMaster, setAssetsMaster] = useState<AssetMaster[]>([]);
  const [origins, setOrigins] = useState<MovementDestination[]>([]);
  const [pendingCollections, setPendingCollections] = useState<CollectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'alert'} | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  const [contactPerson, setContactPerson] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [assetsRes, originsRes, pendingRes] = await Promise.all([
        supabase.from('asset_master').select('*'),
        supabase.from('vw_all_origins').select('*'),
        supabase.from('vw_pending_collections').select('*')
      ]);

      if (assetsRes.data) {
        setAssetsMaster(assetsRes.data);
        if (assetsRes.data.length > 0) setAssetId(assetsRes.data[0].id);
      }
      if (originsRes.data) {
        setOrigins(originsRes.data);
        if (originsRes.data.length > 0) setCustomerId(originsRes.data[0].id);
      }
      if (pendingRes.data) setPendingCollections(pendingRes.data);
    } catch (err) {
      console.error("Error fetching collection data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) return;

    if (!customerId || !assetId || quantity <= 0 || !pickupDate) {
      setNotification({ message: "Please fill in all required fields.", type: 'alert' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('collection_requests').insert([
        normalizePayload({
          customer_id: customerId,
          asset_id: assetId,
          estimated_quantity: quantity,
          preferred_pickup_date: pickupDate,
          contact_person: contactPerson,
          contact_number: contactNumber,
          status: 'Pending'
        })
      ]);

      if (error) throw error;

      setNotification({ message: "Request logged. Our dispatch team will contact you shortly.", type: 'success' });
      setQuantity(0);
      setContactPerson('');
      setContactNumber('');
      fetchData();
    } catch (err: any) {
      console.error("Error logging collection request:", err);
      setNotification({ message: err.message || "Failed to log request.", type: 'alert' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Collection Requests</h2>
          <p className="text-sm text-slate-500 font-medium">Manage customer crate pickups and returns</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'form' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Request Form
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Dispatcher Dashboard
          </button>
        </div>
      </div>

      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right max-w-md ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest">New Pickup Request</h3>
              </div>
              <form onSubmit={handleSubmitRequest} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <MapPin size={14} className="text-emerald-500" /> Customer / Origin
                    </span>
                    <select 
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      value={customerId}
                      onChange={e => setCustomerId(e.target.value)}
                    >
                      {origins.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Package size={14} className="text-blue-500" /> Asset Type
                    </span>
                    <select 
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      value={assetId}
                      onChange={e => setAssetId(e.target.value)}
                    >
                      {assetsMaster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <ArrowRight size={14} className="text-amber-500" /> Estimated Quantity
                    </span>
                    <input 
                      type="number"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      placeholder="e.g. 250"
                      value={quantity || ''}
                      onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Calendar size={14} className="text-rose-500" /> Preferred Pickup Date
                    </span>
                    <input 
                      type="date"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <UserIcon size={14} className="text-slate-400" /> Contact Person
                    </span>
                    <input 
                      type="text"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      placeholder="Name"
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" /> Contact Number
                    </span>
                    <input 
                      type="text"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                      placeholder="Phone"
                      value={contactNumber}
                      onChange={e => setContactNumber(e.target.value)}
                    />
                  </label>
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                >
                  {isSubmitting ? 'Logging...' : 'LOG COLLECTION REQUEST'}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl space-y-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <CheckCircle2 size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-900 text-sm uppercase tracking-widest">Requesting a Pickup</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Logging a request notifies the dispatch team immediately. Ensure the quantity is as accurate as possible to help us allocate the right truck.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest">Pending Collections</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {pendingCollections.length} Requests
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset & Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preferred Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pendingCollections.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <Package size={48} />
                          <p className="text-sm font-bold uppercase tracking-widest">No pending collection requests</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pendingCollections.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900">{req.customer_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">ID: {req.customer_id}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900">{req.asset_name}</p>
                          <p className="text-xs text-blue-600 font-bold">Est. {req.estimated_quantity} units</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Calendar size={14} className="text-slate-400" />
                            {new Date(req.preferred_pickup_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900">{req.contact_person || 'N/A'}</p>
                          <p className="text-xs text-slate-500">{req.contact_number || 'No number'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => onAssign(req)}
                            className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                          >
                            Assign to Driver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionRequests;
