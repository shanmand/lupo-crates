
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { BatchMovement, Truck, Driver } from '../types';
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2, Truck as TruckIcon, User as UserIcon, Database, Filter } from 'lucide-react';

const DatabaseCleanup: React.FC = () => {
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const [movesRes, trucksRes, driversRes] = await Promise.all([
        supabase.from('batch_movements').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*')
      ]);

      if (movesRes.data) setMovements(movesRes.data);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
    } catch (err) {
      console.error("Cleanup Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const orphanedMovements = movements.filter(m => {
    const truckExists = !m.truck_id || trucks.some(t => String(t.id) === String(m.truck_id));
    const driverExists = !m.driver_id || drivers.some(d => String(d.id) === String(m.driver_id));
    return !truckExists || !driverExists;
  });

  const handleReassign = async (movementId: string, field: 'truck_id' | 'driver_id', newValue: string) => {
    setIsSubmitting(true);
    try {
      // Using explicit string casting as requested to handle UUID vs Text mismatch
      const { error } = await supabase
        .from('batch_movements')
        .update({ [field]: String(newValue) })
        .eq('id', movementId);

      if (error) throw error;
      
      setNotification({ msg: "Record re-assigned successfully", type: 'success' });
      await fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Re-assignment failed", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDelete = async (movementId: string) => {
    if (!window.confirm("Delete this movement record?")) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('batch_movements')
        .delete()
        .eq('id', movementId);

      if (error) throw error;
      
      setNotification({ msg: "Record deleted", type: 'success' });
      await fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Deletion failed", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleBulkDeleteOrphans = async () => {
    if (!window.confirm(`Are you sure you want to delete all ${orphanedMovements.length} orphaned records?`)) return;
    setIsSubmitting(true);
    try {
      const idsToDelete = orphanedMovements.map(m => m.id);
      const { error } = await supabase
        .from('batch_movements')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;
      
      setNotification({ msg: `${idsToDelete.length} records deleted`, type: 'success' });
      await fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Bulk deletion failed", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center animate-pulse font-bold text-slate-400">SCANNING FOR ORPHANED RECORDS...</div>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tight"><Database className="text-amber-400" /> Database Integrity Cleanup</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Identify and repair movements with missing truck or driver references.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Orphans Found</p>
              <p className="text-lg font-bold text-amber-400">{orphanedMovements.length}</p>
            </div>
            {orphanedMovements.length > 0 && (
              <button 
                onClick={handleBulkDeleteOrphans}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20"
              >
                <Trash2 size={14} /> Bulk Delete Test Data
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-4">Movement ID / Date</th>
                <th className="px-8 py-4">Batch ID</th>
                <th className="px-8 py-4">Broken Reference</th>
                <th className="px-8 py-4">Repair Action</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orphanedMovements.map(m => {
                const truckMissing = m.truck_id && !trucks.some(t => String(t.id) === String(m.truck_id));
                const driverMissing = m.driver_id && !drivers.some(d => String(d.id) === String(m.driver_id));

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-xs font-black text-slate-900">{m.id}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(m.timestamp).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600">#{m.batch_id}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        {truckMissing && (
                          <div className="flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase">
                            <TruckIcon size={12} /> Missing Truck: {m.truck_id}
                          </div>
                        )}
                        {driverMissing && (
                          <div className="flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase">
                            <UserIcon size={12} /> Missing Driver: {m.driver_id}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-2">
                        {truckMissing && (
                          <select 
                            className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-slate-900"
                            onChange={(e) => handleReassign(m.id, 'truck_id', e.target.value)}
                            value=""
                          >
                            <option value="" disabled>Re-assign Truck...</option>
                            {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                          </select>
                        )}
                        {driverMissing && (
                          <select 
                            className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-slate-900"
                            onChange={(e) => handleReassign(m.id, 'driver_id', e.target.value)}
                            value=""
                          >
                            <option value="" disabled>Re-assign Driver...</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orphanedMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="text-emerald-500" size={48} />
                      <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Database is Healthy</p>
                      <p className="text-xs text-slate-400">No orphaned movement records detected.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DatabaseCleanup;
