
import React, { useState, useEffect } from 'react';
import { 
  Truck as TruckIcon, 
  User as UserIcon, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Clock,
  Calendar,
  X,
  Loader2,
  ArrowRight,
  UserCheck,
  Printer,
  FileText
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Truck, Driver, Branch } from '../types';
import BranchSelector from './BranchSelector';

interface DriverShift {
  id: string;
  driver_id: string;
  truck_id: string;
  start_time: string;
  end_time: string | null;
  manual_end_time: string | null;
  notes: string | null;
  branch_id: string;
  created_at: string;
}

const ShiftManagement: React.FC = () => {
  const [shifts, setShifts] = useState<DriverShift[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [closeShiftData, setCloseShiftData] = useState({
    manualEndTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    notes: ''
  });
  const [newShift, setNewShift] = useState({
    driver_id: '',
    truck_id: '',
    branch_id: '',
    date: new Date().toISOString().split('T')[0],
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    endTime: ''
  });

  const handlePrint = () => {
    window.print();
  };

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [shiftsRes, trucksRes, driversRes, branchesRes] = await Promise.all([
        supabase.from('driver_shifts').select('*').order('start_time', { ascending: false }),
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('branches').select('*').order('name')
      ]);

      if (shiftsRes.data) setShifts(shiftsRes.data);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (err) {
      console.error("Shift Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const startTime = new Date(`${newShift.date}T${newShift.startTime}`).toISOString();
      const endTime = newShift.endTime ? new Date(`${newShift.date}T${newShift.endTime}`).toISOString() : null;

      // End any existing active shifts for this driver or truck if we are starting a "Now" shift
      // or if the user explicitly wants to clear them.
      // For simplicity, we'll keep the auto-end logic but use the provided start time.
      await supabase
        .from('driver_shifts')
        .update({ end_time: startTime })
        .is('end_time', null)
        .or(`driver_id.eq.${newShift.driver_id},truck_id.eq.${newShift.truck_id}`);

      const { error } = await supabase
        .from('driver_shifts')
        .insert([{
          driver_id: newShift.driver_id,
          truck_id: newShift.truck_id,
          branch_id: newShift.branch_id || null,
          start_time: startTime,
          end_time: endTime
        }]);

      if (error) throw error;
      await fetchData();
      setIsModalOpen(false);
      setNewShift({ 
        driver_id: '', 
        truck_id: '', 
        branch_id: '',
        date: new Date().toISOString().split('T')[0],
        startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: ''
      });
    } catch (err: any) {
      console.error("Start Shift Error:", err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId) return;
    setIsLoading(true);
    try {
      const shift = shifts.find(s => s.id === selectedShiftId);
      if (!shift) throw new Error("Shift not found");

      const datePart = new Date(shift.start_time).toISOString().split('T')[0];
      const manualEndTime = new Date(`${datePart}T${closeShiftData.manualEndTime}`).toISOString();

      const { error } = await supabase
        .from('driver_shifts')
        .update({ 
          end_time: new Date().toISOString(),
          manual_end_time: manualEndTime,
          notes: closeShiftData.notes
        })
        .eq('id', selectedShiftId);

      if (error) throw error;
      await fetchData();
      setIsCloseModalOpen(false);
      setSelectedShiftId(null);
      setCloseShiftData({ manualEndTime: '', notes: '' });
    } catch (err: any) {
      console.error("Close Shift Error:", err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const activeShifts = shifts.filter(s => !s.end_time);
  const completedShifts = shifts.filter(s => s.end_time).slice(0, 10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Shift Assignments</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Daily Driver-to-Truck Allocation</p>
        </div>
        <div className="flex gap-4 print:hidden">
          <button 
            onClick={handlePrint}
            className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Printer size={18} /> PRINT REPORT
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={18} /> START NEW SHIFT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Shifts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-emerald-400" />
                <h4 className="font-black text-xs uppercase tracking-widest">Active Shift Log</h4>
              </div>
              <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{activeShifts.length} Active</span>
            </div>
            
            <div className="divide-y divide-slate-50">
              {activeShifts.map(shift => (
                <div key={shift.id} className="p-8 flex flex-col md:flex-row justify-between items-center gap-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-8 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200 shadow-sm">
                        <UserIcon size={24} />
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Driver</p>
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-lg">{drivers.find(d => d.id === shift.driver_id)?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {branches.find(b => b.id === shift.branch_id)?.name || 'No Branch'}
                      </p>
                    </div>

                    <div className="hidden md:block text-slate-300">
                      <ArrowRight size={24} />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                        <TruckIcon size={24} />
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Truck</p>
                    </div>

                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-lg">{trucks.find(t => t.id === shift.truck_id)?.plate_number || 'Unknown'}</p>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                        <CheckCircle2 size={12} /> On Duty
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Date</p>
                      <p className="text-sm font-bold text-slate-900">{new Date(shift.start_time).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Started At</p>
                      <p className="text-sm font-bold text-slate-900">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedShiftId(shift.id);
                        setCloseShiftData({
                          manualEndTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                          notes: ''
                        });
                        setIsCloseModalOpen(true);
                      }}
                      className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 print:hidden"
                    >
                      Close Shift
                    </button>
                  </div>
                </div>
              ))}
              {activeShifts.length === 0 && (
                <div className="p-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Clock size={32} />
                  </div>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No active shifts recorded</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500">Recent Shift History</h4>
            </div>
            <div className="divide-y divide-slate-50">
              {completedShifts.map(shift => (
                <div key={shift.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-black text-slate-900 text-xs">{drivers.find(d => d.id === shift.driver_id)?.full_name}</p>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(shift.start_time).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <TruckIcon size={12} /> {trucks.find(t => t.id === shift.truck_id)?.plate_number}
                  </div>
                </div>
              ))}
              {completedShifts.length === 0 && (
                <div className="p-8 text-center text-slate-300 text-[10px] font-bold uppercase">No history available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">Assign Shift</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Start Daily Log</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleStartShift} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shift Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newShift.date}
                    onChange={e => setNewShift({...newShift, date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Time</label>
                  <input 
                    type="time"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newShift.startTime}
                    onChange={e => setNewShift({...newShift, startTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Time (Optional)</label>
                <input 
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={newShift.endTime}
                  onChange={e => setNewShift({...newShift, endTime: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Driver</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={newShift.driver_id}
                  onChange={e => setNewShift({...newShift, driver_id: e.target.value})}
                >
                  <option value="">Choose Driver...</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Truck</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={newShift.truck_id}
                  onChange={e => setNewShift({...newShift, truck_id: e.target.value})}
                >
                  <option value="">Choose Truck...</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignment</label>
                <BranchSelector 
                  value={newShift.branch_id}
                  onChange={val => setNewShift({...newShift, branch_id: val})}
                  placeholder="Select Branch..."
                />
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                <UserCheck className="text-emerald-600 shrink-0" size={20} />
                <p className="text-[10px] text-emerald-700 font-bold leading-relaxed uppercase">
                  Starting a shift will automatically end any previous active shifts for this driver or truck.
                </p>
              </div>
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'START SHIFT NOW'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">Close Shift</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Finalize Daily Log</p>
              </div>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleCloseShift} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Manual End Time</label>
                <input 
                  type="time"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={closeShiftData.manualEndTime}
                  onChange={e => setCloseShiftData({...closeShiftData, manualEndTime: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shift Notes</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 min-h-[100px]"
                  placeholder="Enter any notes about the shift (e.g., delays, issues)..."
                  value={closeShiftData.notes}
                  onChange={e => setCloseShiftData({...closeShiftData, notes: e.target.value})}
                />
              </div>
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-600 text-white font-black py-5 rounded-2xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'CLOSE SHIFT & SAVE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement;
