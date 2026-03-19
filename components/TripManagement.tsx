
import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Calendar, Plus, ChevronRight, CheckCircle2, Clock, User, Navigation, AlertCircle, Loader2, Save, Trash2, ArrowRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Trip, TripStop, Driver, Truck as TruckType, Source } from '../types';

const TripManagement: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [locations, setLocations] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateTripId = () => `TRIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;

  // New Trip Form State
  const [newTrip, setNewTrip] = useState({
    id: generateTripId(),
    driver_id: '',
    truck_id: '',
    route_name: '',
    status: 'Planned' as const
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [tripsRes, driversRes, trucksRes, locationsRes] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('trucks').select('*'),
        supabase.from('vw_all_sources').select('*')
      ]);

      if (tripsRes.data) setTrips(tripsRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
    } catch (err) {
      console.error("Error fetching trip data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTripStops = async (tripId: string) => {
    const { data, error } = await supabase
      .from('trip_stops')
      .select('*')
      .eq('trip_id', tripId)
      .order('sequence_number', { ascending: true });
    
    if (data) setTripStops(data);
  };

  const handleCreateTrip = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('trips').insert([newTrip]);
      if (insertError) throw insertError;
      
      setShowNewTripModal(false);
      setNewTrip({
        id: generateTripId(),
        driver_id: '',
        truck_id: '',
        route_name: '',
        status: 'Planned' as const
      });
      fetchData();
    } catch (err: any) {
      console.error("Error creating trip:", err);
      setError(err.message || "Failed to create trip. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStop = async (tripId: string, locationId: string) => {
    const nextSeq = tripStops.length + 1;
    try {
      const { error } = await supabase.from('trip_stops').insert([{
        trip_id: tripId,
        location_id: locationId,
        sequence_number: nextSeq,
        status: 'Pending'
      }]);
      if (error) throw error;
      fetchTripStops(tripId);
    } catch (err) {
      console.error("Error adding stop:", err);
    }
  };

  const updateStopStatus = async (stopId: string, status: string) => {
    try {
      const updateData: any = { status };
      if (status === 'Arrived') updateData.actual_arrival = new Date().toISOString();
      if (status === 'Departed') updateData.actual_departure = new Date().toISOString();

      const { error } = await supabase.from('trip_stops').update(updateData).eq('id', stopId);
      if (error) throw error;
      if (selectedTrip) fetchTripStops(selectedTrip.id);
    } catch (err) {
      console.error("Error updating stop:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 bg-slate-50 min-h-screen">
      {/* Header Section */}
      {!isSupabaseConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-3xl flex items-center gap-4 text-amber-800 shadow-sm">
          <div className="bg-amber-500 p-2 rounded-xl text-white shadow-lg shadow-amber-500/20">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight">Supabase Not Configured</p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">MULTI-STOP LOGISTICS</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Route Planning & Driver Dispatch</p>
        </div>
        <button 
          onClick={() => setShowNewTripModal(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/20"
        >
          <Plus size={18} />
          Plan New Route
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Trip List */}
        <div className="xl:col-span-1 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Active & Planned Trips</h3>
          {trips.map(trip => (
            <div 
              key={trip.id}
              onClick={() => {
                setSelectedTrip(trip);
                fetchTripStops(trip.id);
              }}
              className={`p-6 rounded-3xl border transition-all cursor-pointer group ${
                selectedTrip?.id === trip.id 
                ? 'bg-white border-emerald-500 shadow-2xl scale-[1.02]' 
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  trip.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                  trip.status === 'In Progress' ? 'bg-blue-100 text-blue-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {trip.status}
                </div>
                <span className="text-[10px] font-mono text-slate-400">{trip.id}</span>
              </div>
              <h4 className="font-black text-slate-800 text-lg leading-tight">{trip.route_name || 'Unnamed Route'}</h4>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  <User size={14} className="text-slate-400" />
                  {drivers.find(d => d.id === trip.driver_id)?.full_name || 'Unassigned'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  <Truck size={14} className="text-slate-400" />
                  {trucks.find(t => t.id === trip.truck_id)?.plate_number || 'Unassigned'}
                </div>
              </div>
            </div>
          ))}
          {trips.length === 0 && (
            <div className="p-12 text-center bg-slate-100 rounded-3xl border-2 border-dashed border-slate-200">
              <Navigation className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No trips planned yet</p>
            </div>
          )}
        </div>

        {/* Trip Detail / Stop Management */}
        <div className="xl:col-span-2">
          {selectedTrip ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedTrip.route_name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Stop Sequence & Manifest</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    onChange={(e) => handleAddStop(selectedTrip.id, e.target.value)}
                    value=""
                  >
                    <option value="" disabled>+ Add Stop</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 p-8 overflow-y-auto">
                <div className="space-y-6 relative">
                  {/* Vertical Line */}
                  <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-slate-100" />

                  {tripStops.map((stop, idx) => (
                    <div key={stop.id} className="relative flex gap-6 group">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm z-10 transition-all ${
                        stop.status === 'Departed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                        stop.status === 'Arrived' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' :
                        'bg-white border-2 border-slate-100 text-slate-300'
                      }`}>
                        {idx + 1}
                      </div>
                      
                      <div className="flex-1 bg-slate-50 rounded-3xl p-6 border border-slate-100 group-hover:border-slate-200 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-slate-800">{locations.find(l => l.id === stop.location_id)?.name || 'Unknown Location'}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {locations.find(l => l.id === stop.location_id)?.partner_type} • {locations.find(l => l.id === stop.location_id)?.type}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {stop.status === 'Pending' && (
                              <button 
                                onClick={() => updateStopStatus(stop.id, 'Arrived')}
                                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                              >
                                Mark Arrival
                              </button>
                            )}
                            {stop.status === 'Arrived' && (
                              <button 
                                onClick={() => updateStopStatus(stop.id, 'Departed')}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                              >
                                Mark Departure
                              </button>
                            )}
                            {stop.status === 'Departed' && (
                              <div className="flex items-center gap-2 text-emerald-500">
                                <CheckCircle2 size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrival</p>
                            <p className="text-xs font-bold text-slate-700 mt-1">
                              {stop.actual_arrival ? new Date(stop.actual_arrival).toLocaleTimeString() : '--:--'}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departure</p>
                            <p className="text-xs font-bold text-slate-700 mt-1">
                              {stop.actual_departure ? new Date(stop.actual_departure).toLocaleTimeString() : '--:--'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {tripStops.length === 0 && (
                    <div className="py-20 text-center">
                      <MapPin className="mx-auto text-slate-200 mb-4" size={64} />
                      <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No stops added to this route</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-100 rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <div className="text-center space-y-4">
                <Navigation className="mx-auto text-slate-300" size={64} />
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Select a trip to manage stops</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Trip Modal */}
      {showNewTripModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Plan New Route</h3>
              <button onClick={() => setShowNewTripModal(false)} className="text-slate-400 hover:text-slate-600"><Trash2 size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. JHB North Delivery Run"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={newTrip.route_name}
                  onChange={e => setNewTrip({...newTrip, route_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                    value={newTrip.driver_id}
                    onChange={e => setNewTrip({...newTrip, driver_id: e.target.value})}
                  >
                    <option value="">Select Driver</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                    value={newTrip.truck_id}
                    onChange={e => setNewTrip({...newTrip, truck_id: e.target.value})}
                  >
                    <option value="">Select Truck</option>
                    {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCreateTrip}
                disabled={isSaving || !newTrip.route_name || !newTrip.driver_id || !newTrip.truck_id}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Initialize Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripManagement;
