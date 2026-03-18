import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { supabase, uploadFleetDocument } from '../supabase';
import { Driver, Truck as TruckType, Task, Inspection } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const DriverPortal: React.FC = () => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'home' | 'inspection' | 'tasks'>('home');
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
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
    if (!driver || !driver.id) {
      alert('Please ensure your Driver Profile is loaded correctly.');
      return;
    }
    if (!selectedTruckId || !odometer) return;
    setIsLoading(true);
    try {
      const location = await getCurrentLocation();
      
      let odometerPhotoUrl = '';
      if (odometerPhoto) {
        try {
          odometerPhotoUrl = await uploadFleetDocument(odometerPhoto, driver.branch_id || 'mobile', selectedTruckId, `odo_${Date.now()}`);
        } catch (uploadErr) {
          console.error("Odometer photo upload failed:", uploadErr);
          // Continue without photo
        }
      }

      let faultPhotoUrl = '';
      if (faultPhoto) {
        try {
          faultPhotoUrl = await uploadFleetDocument(faultPhoto, driver.branch_id || 'mobile', selectedTruckId, `fault_${Date.now()}`);
        } catch (uploadErr) {
          console.error("Fault photo upload failed:", uploadErr);
          // Continue without photo
        }
      }

      // Automatic Grounding: If any of the safety checkboxes (Tyres, Brakes, Lights) are false, set is_grounded to true
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

      const response = await supabase.from('vehicle_inspections').insert([inspectionData]);
      console.log("Submission Status:", response.status);
      
      if (response.error) throw response.error;

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
          // We can store location in metadata or notes if schema doesn't have lat/long for tasks
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
      let path = '';
      try {
        path = await uploadFleetDocument(file, driver.branch_id || 'mobile', driver.id, 'driver_license_renewal');
      } catch (uploadErr) {
        console.error("License photo upload failed:", uploadErr);
        throw new Error("Failed to upload license photo. Please try again.");
      }
      
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

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
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
              className="w-full bg-amber-500 text-slate-900 font-black py-5 rounded-2xl hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'ACCESS PORTAL'}
            </button>
          </form>

          {notification && (
            <div className={`p-4 rounded-2xl text-center font-bold text-sm ${notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {notification.msg}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const getExpiryDays = (date?: string) => {
    if (!date) return null;
    return differenceInDays(parseISO(date), new Date());
  };

  const licenseDays = getExpiryDays(driver.license_expiry);
  const prdpDays = getExpiryDays(driver.prdp_expiry);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Mobile Header */}
      <header className="bg-slate-900 text-white p-6 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center font-black text-slate-900 shadow-lg">
              {driver.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="font-black text-lg tracking-tight leading-none">{driver.full_name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Driver ID: {driver.id}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {notification && (
          <div className={`p-4 rounded-2xl text-center font-bold text-sm animate-in slide-in-from-top ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {notification.msg}
          </div>
        )}

        {view === 'home' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Expiry Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-6 rounded-[2rem] border shadow-sm ${licenseDays !== null && licenseDays < 30 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                <Calendar size={24} className={licenseDays !== null && licenseDays < 30 ? 'text-rose-500' : 'text-slate-400'} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">License Expiry</p>
                <p className={`text-2xl font-black mt-1 ${licenseDays !== null && licenseDays < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {licenseDays !== null ? `${licenseDays} Days` : 'N/A'}
                </p>
              </div>
              <div className={`p-6 rounded-[2rem] border shadow-sm ${prdpDays !== null && prdpDays < 30 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                <ShieldCheck size={24} className={prdpDays !== null && prdpDays < 30 ? 'text-rose-500' : 'text-slate-400'} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">PrDP Expiry</p>
                <p className={`text-2xl font-black mt-1 ${prdpDays !== null && prdpDays < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {prdpDays !== null ? `${prdpDays} Days` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Quick Actions</h3>
              <button 
                onClick={() => setView('inspection')}
                className="w-full bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-95 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <ClipboardCheck size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900">Daily Inspection</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Pre-trip safety checklist</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-slate-900 transition-colors" />
              </button>

              <label className="w-full bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group active:scale-95 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900">Renewed my License</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Upload new license photo</p>
                  </div>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleRenewLicense} />
                <ChevronRight className="text-slate-300 group-hover:text-slate-900 transition-colors" />
              </label>
            </div>

            {/* Recent Tasks Preview */}
            <div className="space-y-4">
              <div className="flex justify-between items-center ml-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Assigned Tasks</h3>
                <button onClick={() => setView('tasks')} className="text-[10px] font-black text-amber-600 uppercase">View All</button>
              </div>
              <div className="space-y-3">
                {myTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${task.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {task.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">{task.title}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{task.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {myTasks.length === 0 && (
                  <div className="text-center py-8 bg-slate-100/50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-xs font-bold uppercase italic">No tasks assigned</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'inspection' && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setView('home')} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Pre-Trip Inspection</h3>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 h-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 rounded-full transition-all ${inspectionStep >= s ? 'bg-amber-500' : 'bg-slate-200'}`} />
              ))}
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8">
              {inspectionStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Truck</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500"
                      value={selectedTruckId}
                      onChange={e => setSelectedTruckId(e.target.value)}
                    >
                      <option value="">Choose a truck...</option>
                      {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Odometer</label>
                    <input 
                      type="number"
                      placeholder="Enter reading..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500"
                      value={odometer}
                      onChange={e => setOdometer(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Odometer Photo</label>
                    <label className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-all">
                      {odometerPhoto ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-xs">
                          <CheckCircle2 size={20} /> PHOTO CAPTURED
                        </div>
                      ) : (
                        <>
                          <Camera size={32} className="text-slate-300 mb-2" />
                          <span className="text-[10px] font-black text-slate-400 uppercase">Take Photo</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => setOdometerPhoto(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <button 
                    disabled={!selectedTruckId || !odometer || !odometerPhoto}
                    onClick={() => setInspectionStep(2)}
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl disabled:opacity-50"
                  >
                    NEXT STEP
                  </button>
                </div>
              )}

              {inspectionStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Safety Checklist</h4>
                  <div className="space-y-4">
                    {Object.entries(checklist).map(([key, val]) => (
                      <button 
                        key={key}
                        onClick={() => setChecklist({...checklist, [key]: !val})}
                        className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${val ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
                      >
                        <span className="font-black uppercase text-xs tracking-widest">
                          {key === 'fluids' ? 'Oil / Water' : 
                           key === 'licenseDisc' ? 'License Disc' : 
                           key}
                        </span>
                        {val ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setInspectionStep(1)} className="flex-1 bg-slate-100 text-slate-400 font-black py-5 rounded-2xl">BACK</button>
                    <button onClick={() => setInspectionStep(3)} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-2xl">NEXT</button>
                  </div>
                </div>
              )}

              {inspectionStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Fault Reporting</h4>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fault Description (Notes)</label>
                    <textarea 
                      placeholder="Describe any issues..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500 min-h-[120px]"
                      value={faultNotes}
                      onChange={e => setFaultNotes(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fault Photo</label>
                    <label className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-all">
                      {faultPhoto ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-xs">
                          <CheckCircle2 size={20} /> PHOTO CAPTURED
                        </div>
                      ) : (
                        <>
                          <Camera size={32} className="text-slate-300 mb-2" />
                          <span className="text-[10px] font-black text-slate-400 uppercase">Take Photo</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => setFaultPhoto(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setInspectionStep(2)} className="flex-1 bg-slate-100 text-slate-400 font-black py-5 rounded-2xl">BACK</button>
                    <button 
                      disabled={isLoading || (Object.values(checklist).some(v => !v) && (!faultNotes || !faultPhoto))}
                      onClick={handleInspectionSubmit}
                      className="flex-1 bg-amber-500 text-slate-900 font-black py-5 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'SUBMIT REPORT'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'tasks' && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setView('home')} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Assigned Tasks</h3>
            </div>

            <div className="space-y-4">
              {myTasks.map(task => (
                <div key={task.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900">{task.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${task.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      {task.priority}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1"><Clock size={14} /> {format(parseISO(task.due_date), 'dd MMM HH:mm')}</div>
                    <div className="flex items-center gap-1"><MapPin size={14} /> Verified GPS</div>
                  </div>

                  {task.status !== 'Completed' && (
                    <div className="flex gap-3 pt-2">
                      {task.status === 'Pending' && (
                        <button 
                          onClick={() => handleTaskUpdate(task.id, 'In Progress')}
                          className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest"
                        >
                          START TASK
                        </button>
                      )}
                      {task.status === 'In Progress' && (
                        <button 
                          onClick={() => handleTaskUpdate(task.id, 'Completed')}
                          className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                        >
                          MARK DONE
                        </button>
                      )}
                    </div>
                  )}
                  {task.status === 'Completed' && (
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest">
                      <CheckCircle2 size={18} /> TASK COMPLETED
                    </div>
                  )}
                </div>
              ))}
              {myTasks.length === 0 && (
                <div className="text-center py-20">
                  <ListTodo size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No tasks assigned to you</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'home' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <Smartphone size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setView('inspection')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'inspection' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <ClipboardCheck size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Inspect</span>
        </button>
        <button 
          onClick={() => setView('tasks')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'tasks' ? 'text-amber-600' : 'text-slate-400'}`}
        >
          <ListTodo size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Tasks</span>
        </button>
      </nav>
    </div>
  );
};

export default DriverPortal;
