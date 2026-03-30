import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  User, 
  Calendar, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  LogOut, 
  ChevronRight, 
  ClipboardCheck, 
  ListTodo,
  Upload,
  Loader2,
  Smartphone,
  ShieldCheck,
  ArrowLeft,
  Home
} from 'lucide-react';
import { supabase, uploadFleetDocument } from '../supabase';
import { Driver, Truck as TruckType, Task, Inspection, Trip } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const DriverPortal: React.FC = () => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'home' | 'inspection' | 'trips' | 'profile'>('home');
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Inspection Form State
  const [inspectionStep, setInspectionStep] = useState(1);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [checklist, setChecklist] = useState({
    tyres: true,
    lights: true,
    brakes: true,
    fluids: true,
    licenseDisc: true
  });
  const [faultNotes, setFaultNotes] = useState('');
  const [faultPhoto, setFaultPhoto] = useState<File | null>(null);

  useEffect(() => {
    const savedDriver = localStorage.getItem('shuku_driver_session');
    if (savedDriver) {
      setDriver(JSON.parse(savedDriver));
    }
    fetchTrucks();
  }, []);

  useEffect(() => {
    if (driver) {
      fetchTasks();
      fetchTrips();
    }
  }, [driver]);

  const fetchTrucks = async () => {
    const { data } = await supabase.from('trucks').select('*').order('plate_number');
    if (data) setTrucks(data);
  };

  const fetchTasks = async () => {
    if (!driver) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', driver.id)
      .order('created_at', { ascending: false });
    if (data) setMyTasks(data);
  };

  const fetchTrips = async () => {
    if (!driver) return;
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false });
    if (data) setMyTrips(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .or(`license_number.eq.${loginIdentifier},contact_number.eq.${loginIdentifier}`)
        .eq('is_active', true)
        .single();

      if (error || !data) throw new Error("Driver not found or inactive");

      setDriver(data);
      localStorage.setItem('shuku_driver_session', JSON.stringify(data));
      setNotification({ msg: `Welcome back, ${data.full_name}`, type: 'success' });
    } catch (err: any) {
      setNotification({ msg: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleLogout = () => {
    setDriver(null);
    localStorage.removeItem('shuku_driver_session');
    setView('home');
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 10000 }
      );
    });
  };

  const handleInspectionSubmit = async () => {
    if (!driver || !driver.id) return;
    if (!selectedTruckId || !odometer) return;
    setIsLoading(true);
    try {
      const location = await getCurrentLocation();
      
      let odometerPhotoUrl = '';
      if (odometerPhoto) {
        odometerPhotoUrl = await uploadFleetDocument(odometerPhoto, driver.branch_id || 'mobile', selectedTruckId, `odo_${Date.now()}`);
      }

      let faultPhotoUrl = '';
      if (faultPhoto) {
        faultPhotoUrl = await uploadFleetDocument(faultPhoto, driver.branch_id || 'mobile', selectedTruckId, `fault_${Date.now()}`);
      }

      const isGrounded = !checklist.tyres || !checklist.brakes || !checklist.lights;

      const inspectionData: Inspection = {
        driver_id: String(driver.id),
        truck_id: String(selectedTruckId),
        odometer_reading: parseInt(odometer),
        odometer_photo_url: odometerPhotoUrl,
        tyres_ok: checklist.tyres,
        lights_ok: checklist.lights,
        brakes_ok: checklist.brakes,
        fluids_ok: checklist.fluids,
        license_disc_present: checklist.licenseDisc,
        fault_description: faultNotes,
        fault_photo_url: faultPhotoUrl,
        is_grounded: isGrounded,
        branch_id: driver.branch_id,
        latitude: location?.lat,
        longitude: location?.lng
      };

      const { error } = await supabase.from('vehicle_inspections').insert([inspectionData]);
      if (error) throw error;

      setNotification({ msg: "Report Submitted Successfully", type: 'success' });
      setView('home');
      resetInspection();
    } catch (err: any) {
      setNotification({ msg: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const resetInspection = () => {
    setInspectionStep(1);
    setSelectedTruckId('');
    setOdometer('');
    setOdometerPhoto(null);
    setChecklist({ tyres: true, lights: true, brakes: true, fluids: true, licenseDisc: true });
    setFaultNotes('');
    setFaultPhoto(null);
  };

  const handleTaskUpdate = async (taskId: string, status: 'In Progress' | 'Completed') => {
    setIsLoading(true);
    try {
      const location = await getCurrentLocation();
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status, 
          description: `[Location: ${location?.lat}, ${location?.lng}] ` + (myTasks.find(t => t.id === taskId)?.description || '')
        })
        .eq('id', taskId);

      if (error) throw error;
      setNotification({ msg: `Task marked as ${status}`, type: 'success' });
      fetchTasks();
    } catch (err: any) {
      setNotification({ msg: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleRenewLicense = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !driver) return;

    setIsLoading(true);
    try {
      const path = await uploadFleetDocument(file, driver.branch_id || 'mobile', driver.id, 'driver_license_renewal');
      const { error } = await supabase
        .from('drivers')
        .update({ license_doc_url: path })
        .eq('id', driver.id);

      if (error) throw error;
      setNotification({ msg: "License photo uploaded for verification", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const getExpiryDays = (date?: string) => {
    if (!date) return null;
    return differenceInDays(parseISO(date), new Date());
  };

  const licenseDays = getExpiryDays(driver?.license_expiry);
  const prdpDays = getExpiryDays(driver?.prdp_expiry);

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
              <Truck className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">SHUKU DRIVER</h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Mobile Self-Service Portal</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">License or Phone Number</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="Enter credentials..."
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl active:scale-95 transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 h-14"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'ACCESS PORTAL'}
            </button>
          </form>

          {notification && (
            <div className={`p-4 rounded-2xl text-center font-bold text-sm ${notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {notification.msg}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <header className="py-6 flex justify-between items-center sticky top-0 bg-slate-50/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-900 shadow-lg">
              {driver.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="font-black text-base tracking-tight leading-none">{driver.full_name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Lupo Bakery Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {notification && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
               >
                 {notification.msg}
               </motion.div>
             )}
          </div>
        </header>

        <main className="space-y-6">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-5 rounded-3xl border shadow-sm ${licenseDays !== null && licenseDays < 30 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                    <Calendar size={20} className={licenseDays !== null && licenseDays < 30 ? 'text-rose-500' : 'text-slate-400'} />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3">License</p>
                    <p className={`text-xl font-black mt-0.5 ${licenseDays !== null && licenseDays < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {licenseDays !== null ? `${licenseDays}d` : 'N/A'}
                    </p>
                  </div>
                  <div className={`p-5 rounded-3xl border shadow-sm ${prdpDays !== null && prdpDays < 30 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                    <ShieldCheck size={20} className={prdpDays !== null && prdpDays < 30 ? 'text-rose-500' : 'text-slate-400'} />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3">PrDP</p>
                    <p className={`text-xl font-black mt-0.5 ${prdpDays !== null && prdpDays < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {prdpDays !== null ? `${prdpDays}d` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Quick Actions</h3>
                  <button 
                    onClick={() => setView('inspection')}
                    className="w-full h-20 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                        <ClipboardCheck size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-sm text-slate-900">Daily Inspection</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Pre-trip checklist</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>

                  <label className="w-full h-20 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Upload size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-sm text-slate-900">Renew License</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Upload new photo</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleRenewLicense} />
                    <ChevronRight size={18} className="text-slate-300" />
                  </label>
                </div>

                {/* Tasks Preview */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Tasks</h3>
                    <button onClick={() => setView('trips')} className="text-[10px] font-black text-amber-600 uppercase">View All</button>
                  </div>
                  <div className="space-y-2">
                    {myTasks.filter(t => t.status !== 'Completed').slice(0, 3).map(task => (
                      <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-xs">{task.title}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{task.priority} Priority</p>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    ))}
                    {myTasks.filter(t => t.status !== 'Completed').length === 0 && (
                      <div className="text-center py-6 bg-white rounded-3xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-[10px] font-bold uppercase italic">No active tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'inspection' && (
              <motion.div 
                key="inspection"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95">
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Vehicle Inspection</h3>
                </div>

                <div className="flex gap-1.5 h-1">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`flex-1 rounded-full transition-all ${inspectionStep >= s ? 'bg-amber-500' : 'bg-slate-200'}`} />
                  ))}
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg space-y-6">
                  {inspectionStep === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Vehicle</label>
                        <select 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                          value={selectedTruckId}
                          onChange={e => setSelectedTruckId(e.target.value)}
                        >
                          <option value="">Choose vehicle...</option>
                          {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Odometer Reading</label>
                        <input 
                          type="text"
                          inputMode="numeric"
                          placeholder="000000"
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500"
                          value={odometer}
                          onChange={e => setOdometer(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Odometer Photo</label>
                        <label className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-slate-100 transition-all">
                          {odometerPhoto ? (
                            <div className="flex flex-col items-center gap-2 text-emerald-600 font-black text-[10px]">
                              <CheckCircle2 size={24} /> PHOTO READY
                            </div>
                          ) : (
                            <>
                              <Camera size={32} className="text-slate-300 mb-2" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">Capture Odometer</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => setOdometerPhoto(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <button 
                        disabled={!selectedTruckId || !odometer || !odometerPhoto}
                        onClick={() => setInspectionStep(2)}
                        className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl disabled:opacity-50 active:scale-95 transition-all"
                      >
                        CONTINUE
                      </button>
                    </div>
                  )}

                  {inspectionStep === 2 && (
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Safety Checklist</h4>
                      <div className="space-y-3">
                        {Object.entries(checklist).map(([key, val]) => (
                          <button 
                            key={key}
                            onClick={() => setChecklist({...checklist, [key]: !val})}
                            className={`w-full h-16 px-5 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.98] ${val ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
                          >
                            <span className="font-black uppercase text-[10px] tracking-widest">
                              {key === 'fluids' ? 'Oil / Water' : 
                               key === 'licenseDisc' ? 'License Disc' : 
                               key}
                            </span>
                            <div className={`w-10 h-6 rounded-full relative transition-colors ${val ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                               <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${val ? 'right-1' : 'left-1'}`} />
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setInspectionStep(1)} className="flex-1 h-14 bg-slate-100 text-slate-500 font-black rounded-2xl active:scale-95">BACK</button>
                        <button onClick={() => setInspectionStep(3)} className="flex-1 h-14 bg-slate-900 text-white font-black rounded-2xl active:scale-95">NEXT</button>
                      </div>
                    </div>
                  )}

                  {inspectionStep === 3 && (
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fault Reporting</h4>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fault Notes (Optional)</label>
                        <textarea 
                          placeholder="Describe any issues..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                          value={faultNotes}
                          onChange={e => setFaultNotes(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fault Photo</label>
                        <label className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer active:bg-slate-100 transition-all">
                          {faultPhoto ? (
                            <div className="flex flex-col items-center gap-2 text-emerald-600 font-black text-[10px]">
                              <CheckCircle2 size={24} /> PHOTO ATTACHED
                            </div>
                          ) : (
                            <>
                              <Camera size={32} className="text-slate-300 mb-2" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">Capture Fault</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => setFaultPhoto(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setInspectionStep(2)} className="flex-1 h-14 bg-slate-100 text-slate-500 font-black rounded-2xl active:scale-95">BACK</button>
                        <button 
                          disabled={isLoading || (Object.values(checklist).some(v => !v) && (!faultNotes || !faultPhoto))}
                          onClick={handleInspectionSubmit}
                          className="flex-2 h-14 bg-amber-500 text-slate-900 font-black rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95"
                        >
                          {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'SUBMIT REPORT'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'trips' && (
              <motion.div 
                key="trips"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95">
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Trips & Tasks</h3>
                </div>

                <div className="space-y-4">
                  {myTasks.map(task => (
                    <div key={task.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-black text-sm text-slate-900">{task.title}</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{task.description}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ml-2 ${task.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                          {task.priority}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-1"><Clock size={12} /> {format(parseISO(task.due_date), 'dd MMM HH:mm')}</div>
                        <div className="flex items-center gap-1"><MapPin size={12} /> GPS Verified</div>
                      </div>

                      {task.status !== 'Completed' && (
                        <div className="flex gap-2 pt-1">
                          {task.status === 'Pending' && (
                            <button 
                              onClick={() => handleTaskUpdate(task.id, 'In Progress')}
                              className="flex-1 h-12 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95"
                            >
                              START TASK
                            </button>
                          )}
                          {task.status === 'In Progress' && (
                            <button 
                              onClick={() => handleTaskUpdate(task.id, 'Completed')}
                              className="flex-1 h-12 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95"
                            >
                              COMPLETE
                            </button>
                          )}
                        </div>
                      )}
                      {task.status === 'Completed' && (
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest">
                          <CheckCircle2 size={14} /> COMPLETED
                        </div>
                      )}
                    </div>
                  ))}
                  {myTasks.length === 0 && (
                    <div className="text-center py-20">
                      <ListTodo size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">No assigned tasks</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95">
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">My Profile</h3>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 rounded-[2rem] bg-amber-500 flex items-center justify-center text-4xl font-black text-slate-900 shadow-xl">
                      {driver.full_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900">{driver.full_name}</h4>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Lupo Delivery Partner</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">License Number</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{driver.license_number || 'Not Recorded'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{driver.contact_number || 'Not Recorded'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch Assignment</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{driver.branch_id || 'Global'}</p>
                    </div>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full h-14 bg-rose-50 text-rose-600 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <LogOut size={20} />
                    LOG OUT
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 flex justify-between items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 w-16 transition-all active:scale-90 ${view === 'home' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <Home size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setView('inspection')}
          className={`flex flex-col items-center gap-1 w-16 transition-all active:scale-90 ${view === 'inspection' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <ClipboardCheck size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Inspect</span>
        </button>
        <button 
          onClick={() => setView('trips')}
          className={`flex flex-col items-center gap-1 w-16 transition-all active:scale-90 ${view === 'trips' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <Truck size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Trips</span>
        </button>
        <button 
          onClick={() => setView('profile')}
          className={`flex flex-col items-center gap-1 w-16 transition-all active:scale-90 ${view === 'profile' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <User size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default DriverPortal;
