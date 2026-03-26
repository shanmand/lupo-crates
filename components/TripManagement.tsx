
import React, { useState, useEffect, useRef } from 'react';
import { Truck, MapPin, Calendar, Plus, ChevronRight, CheckCircle2, Clock, User, Navigation, AlertCircle, Loader2, Save, Trash2, ArrowRight, ArrowUp, ArrowDown, Edit, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Trip, TripStop, Driver, Truck as TruckType, Source } from '../types';
import { useMasterData } from '../MasterDataContext';

const DistanceEstimator: React.FC<{ startLocationId: string; stops: TripStop[]; locations: any[] }> = ({ startLocationId, stops, locations }) => {
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const lastCalculationRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const calculateDistance = async () => {
      if (!startLocationId || stops.length === 0) {
        setTotalKm(null);
        return;
      }

      // Create a key to check if we need to recalculate
      const calculationKey = `${startLocationId}-${stops.map(s => s.location_id).join(',')}`;
      if (calculationKey === lastCalculationRef.current) return;
      lastCalculationRef.current = calculationKey;

      // Cancel previous calculation if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsCalculating(true);
      try {
        const startLoc = locations.find(l => l.id === startLocationId);
        if (!startLoc?.address) {
          if (!isCancelled) setTotalKm(null);
          return;
        }

        // Helper to get coordinates from address (Nominatim)
        const getCoords = async (address: string) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
              signal: abortControllerRef.current?.signal
            });
            const data = await res.json();
            if (data && data[0]) {
              return { lat: data[0].lat, lon: data[0].lon };
            }
          } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Geocoding error:", e);
          }
          return null;
        };

        let totalDistance = 0;
        let currentOriginCoords = await getCoords(startLoc.address);

        if (!currentOriginCoords) {
          // Fallback: simple estimation if geocoding fails
          if (!isCancelled) setTotalKm(stops.length * 15); // Rough guess: 15km per stop
          return;
        }

        for (const stop of stops) {
          if (isCancelled) break;
          const destLoc = locations.find(l => l.id === stop.location_id);
          if (!destLoc?.address) continue;

          const destCoords = await getCoords(destLoc.address);
          if (!destCoords) continue;

          // OSRM Routing API (Free)
          try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentOriginCoords.lon},${currentOriginCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
            const routeRes = await fetch(osrmUrl, {
              signal: abortControllerRef.current?.signal
            });
            const routeData = await routeRes.json();

            if (routeData.routes?.[0]?.distance) {
              totalDistance += routeData.routes[0].distance;
              currentOriginCoords = destCoords;
            } else {
              throw new Error("No route found");
            }
          } catch (e: any) {
            if (e.name === 'AbortError') break;
            // Fallback to Haversine if OSRM fails
            const R = 6371e3; // metres
            const φ1 = (parseFloat(currentOriginCoords.lat) * Math.PI) / 180;
            const φ2 = (parseFloat(destCoords.lat) * Math.PI) / 180;
            const Δφ = ((parseFloat(destCoords.lat) - parseFloat(currentOriginCoords.lat)) * Math.PI) / 180;
            const Δλ = ((parseFloat(destCoords.lon) - parseFloat(currentOriginCoords.lon)) * Math.PI) / 180;

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c; // in metres
            
            totalDistance += d * 1.3; // Add 30% for road distance vs straight line
            currentOriginCoords = destCoords;
          }
          
          // Respect Nominatim rate limits (1 req/sec)
          await new Promise(r => setTimeout(r, 1000));
        }

        if (!isCancelled) setTotalKm(totalDistance / 1000);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error("Error calculating total distance:", err);
      } finally {
        if (!isCancelled) setIsCalculating(false);
      }
    };

    calculateDistance();

    return () => {
      isCancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [startLocationId, stops, locations]);

  if (!startLocationId || stops.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
      <Navigation size={12} />
      {isCalculating ? 'Calculating...' : `${totalKm?.toFixed(1) || '--'} KM Estimated`}
    </div>
  );
};

const TripManagement: React.FC = () => {
  const { 
    trips, 
    drivers, 
    trucks, 
    allSources: locations, 
    isLoading,
    refreshTrips
  } = useMasterData();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAddingStop, setIsAddingStop] = useState(false);

  const generateTripId = () => `TRIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;

  // New Trip Form State
  const [newTrip, setNewTrip] = useState({
    id: generateTripId(),
    driver_id: '',
    truck_id: '',
    start_location_id: '',
    route_name: '',
    status: 'Planned' as const,
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_departure_time: '08:00',
    start_odometer: 0,
    end_odometer: 0
  });

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

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
        start_location_id: '',
        route_name: '',
        status: 'Planned' as const,
        scheduled_date: new Date().toISOString().slice(0, 10),
        scheduled_departure_time: '08:00',
        start_odometer: 0,
        end_odometer: 0
      });
      refreshTrips();
    } catch (err: any) {
      console.error("Error creating trip:", err);
      setError(err.message || "Failed to create trip. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStop = async (tripId: string, locationId: string) => {
    if (!locationId) return;
    setIsAddingStop(true);
    setError(null);
    const nextSeq = tripStops.length + 1;
    try {
      const { error } = await supabase.from('trip_stops').insert([{
        trip_id: tripId,
        location_id: locationId,
        sequence_number: nextSeq,
        status: 'Pending'
      }]);
      if (error) throw error;
      await fetchTripStops(tripId);
    } catch (err: any) {
      console.error("Error adding stop:", err);
      setError(err.message || "Failed to add stop. Please try again.");
    } finally {
      setIsAddingStop(false);
    }
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!window.confirm('Are you sure you want to remove this stop?')) return;
    try {
      const { error } = await supabase.from('trip_stops').delete().eq('id', stopId);
      if (error) throw error;
      
      // Re-sequence remaining stops
      if (selectedTrip) {
        const remainingStops = tripStops.filter(s => s.id !== stopId);
        for (let i = 0; i < remainingStops.length; i++) {
          await supabase
            .from('trip_stops')
            .update({ sequence_number: i + 1 })
            .eq('id', remainingStops[i].id);
        }
        fetchTripStops(selectedTrip.id);
      }
    } catch (err) {
      console.error("Error deleting stop:", err);
    }
  };

  const handleMoveStop = async (stopId: string, direction: 'up' | 'down') => {
    const idx = tripStops.findIndex(s => s.id === stopId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === tripStops.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const stopA = tripStops[idx];
    const stopB = tripStops[otherIdx];

    try {
      await Promise.all([
        supabase.from('trip_stops').update({ sequence_number: stopB.sequence_number }).eq('id', stopA.id),
        supabase.from('trip_stops').update({ sequence_number: stopA.sequence_number }).eq('id', stopB.id)
      ]);
      if (selectedTrip) fetchTripStops(selectedTrip.id);
    } catch (err) {
      console.error("Error reordering stops:", err);
    }
  };

  const handleUpdateTrip = async () => {
    if (!editingTrip) return;
    setIsSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          driver_id: editingTrip.driver_id,
          truck_id: editingTrip.truck_id,
          start_location_id: editingTrip.start_location_id,
          route_name: editingTrip.route_name,
          status: editingTrip.status,
          scheduled_date: editingTrip.scheduled_date,
          scheduled_departure_time: editingTrip.scheduled_departure_time,
          start_odometer: editingTrip.start_odometer,
          end_odometer: editingTrip.end_odometer
        })
        .eq('id', editingTrip.id);
      
      if (updateError) throw updateError;
      
      setShowEditTripModal(false);
      setSelectedTrip(editingTrip);
      refreshTrips();
    } catch (err: any) {
      console.error("Error updating trip:", err);
      setError(err.message || "Failed to update trip.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm('Are you sure you want to delete this entire trip and all its stops?')) return;
    try {
      // Delete stops first (cascade might handle it but let's be explicit)
      await supabase.from('trip_stops').delete().eq('trip_id', tripId);
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      
      setSelectedTrip(null);
      setTripStops([]);
      refreshTrips();
    } catch (err) {
      console.error("Error deleting trip:", err);
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

  const handlePrintRouteSheet = (trip: Trip) => {
    const driver = drivers.find(d => d.id === trip.driver_id);
    const truck = trucks.find(t => t.id === trip.truck_id);
    const stops = tripStops;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Route Sheet - ${trip.id}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .meta-item { border: 1px solid #eee; padding: 15px; border-radius: 8px; }
            .label { font-size: 10px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 5px; }
            .value { font-size: 16px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8f9fa; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 13px; }
            .odometer-section { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .odometer-box { border: 1px solid #000; padding: 20px; height: 60px; display: flex; align-items: flex-end; }
            .signature-section { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .signature-box { border-top: 1px solid #000; padding-top: 10px; text-align: center; font-size: 12px; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ROUTE DISPATCH SHEET</div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;">Trip ID: ${trip.id}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold;">${trip.route_name || 'Unnamed Route'}</div>
              <div style="font-size: 12px;">Date: ${trip.scheduled_date || new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div class="meta">
            <div class="meta-item">
              <div class="label">Driver Information</div>
              <div class="value">${driver?.full_name || 'N/A'}</div>
              <div style="font-size: 11px; color: #666;">License: ${driver?.license_number || '---'}</div>
            </div>
            <div class="meta-item">
              <div class="label">Vehicle Information</div>
              <div class="value">${truck?.plate_number || 'N/A'}</div>
              <div style="font-size: 11px; color: #666;">Model: ${truck?.model || '---'}</div>
            </div>
            <div class="meta-item">
              <div class="label">Scheduled Departure</div>
              <div class="value">${trip.scheduled_departure_time || '---'}</div>
            </div>
            <div class="meta-item">
              <div class="label">Status</div>
              <div class="value">${trip.status}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Seq</th>
                <th>Destination / Customer</th>
                <th>Address</th>
                <th style="width: 100px;">Arrival</th>
                <th style="width: 100px;">Departure</th>
                <th style="width: 150px;">Signature</th>
              </tr>
            </thead>
            <tbody>
              ${stops.map((stop, i) => {
                const loc = locations.find(l => l.id === stop.location_id);
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${loc?.name || 'Unknown'}</strong><br/><span style="font-size: 10px; color: #888;">${loc?.partner_type || ''}</span></td>
                    <td>${loc?.address || loc?.id || '---'}</td>
                    <td></td>
                    <td></td>
                    <td style="border-bottom: 1px solid #000;"></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="odometer-section">
            <div>
              <div class="label">Start Odometer Reading</div>
              <div class="odometer-box"></div>
            </div>
            <div>
              <div class="label">End Odometer Reading</div>
              <div class="odometer-box"></div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box">Driver Signature</div>
            <div class="signature-box">Manager Authorization</div>
          </div>

          <script>
            window.onload = () => {
              window.print();
              // window.close(); // Optional: close after printing
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTrip(trip);
                      setShowEditTripModal(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTrip(trip.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
                {trip.scheduled_date && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-black uppercase tracking-widest pt-2 border-t border-slate-50">
                    <Calendar size={14} />
                    {new Date(trip.scheduled_date).toLocaleDateString()} @ {trip.scheduled_departure_time || '08:00'}
                  </div>
                )}
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
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stop Sequence & Manifest</p>
                    {selectedTrip.scheduled_date && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                        <Calendar size={12} />
                        {new Date(selectedTrip.scheduled_date).toLocaleDateString()} @ {selectedTrip.scheduled_departure_time || '08:00'}
                      </div>
                    )}
                    <DistanceEstimator 
                      startLocationId={selectedTrip.start_location_id} 
                      stops={tripStops} 
                      locations={locations} 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePrintRouteSheet(selectedTrip)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all"
                  >
                    <Save size={14} />
                    Print Route Sheet
                  </button>
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    onChange={(e) => handleAddStop(selectedTrip.id, e.target.value)}
                    value=""
                    disabled={isAddingStop}
                  >
                    <option value="" disabled>{isAddingStop ? 'Adding...' : '+ Add Stop'}</option>
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
                              <div className="flex gap-1 mr-2">
                                <button 
                                  onClick={() => handleMoveStop(stop.id, 'up')}
                                  disabled={idx === 0}
                                  className="p-2 text-slate-400 hover:text-emerald-500 disabled:opacity-20"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button 
                                  onClick={() => handleMoveStop(stop.id, 'down')}
                                  disabled={idx === tripStops.length - 1}
                                  className="p-2 text-slate-400 hover:text-emerald-500 disabled:opacity-20"
                                >
                                  <ArrowDown size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteStop(stop.id)}
                                  className="p-2 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
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

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Starting Point</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                  value={newTrip.start_location_id}
                  onChange={e => setNewTrip({...newTrip, start_location_id: e.target.value})}
                >
                  <option value="">Select Starting Point</option>
                  {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.display_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={newTrip.scheduled_date}
                    onChange={e => setNewTrip({...newTrip, scheduled_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departure Time</label>
                  <input 
                    type="time" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={newTrip.scheduled_departure_time}
                    onChange={e => setNewTrip({...newTrip, scheduled_departure_time: e.target.value})}
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Odometer</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={newTrip.start_odometer}
                    onChange={e => setNewTrip({...newTrip, start_odometer: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Odometer</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={newTrip.end_odometer}
                    onChange={e => setNewTrip({...newTrip, end_odometer: parseInt(e.target.value) || 0})}
                  />
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

      {/* Edit Trip Modal */}
      {showEditTripModal && editingTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Edit Trip Details</h3>
              <button onClick={() => setShowEditTripModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={editingTrip.route_name}
                  onChange={e => setEditingTrip({...editingTrip, route_name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Starting Point</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                  value={editingTrip.start_location_id || ''}
                  onChange={e => setEditingTrip({...editingTrip, start_location_id: e.target.value})}
                >
                  <option value="">Select Starting Point</option>
                  {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.display_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={editingTrip.scheduled_date}
                    onChange={e => setEditingTrip({...editingTrip, scheduled_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departure Time</label>
                  <input 
                    type="time" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={editingTrip.scheduled_departure_time}
                    onChange={e => setEditingTrip({...editingTrip, scheduled_departure_time: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                    value={editingTrip.driver_id}
                    onChange={e => setEditingTrip({...editingTrip, driver_id: e.target.value})}
                  >
                    <option value="">Select Driver</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                    value={editingTrip.truck_id}
                    onChange={e => setEditingTrip({...editingTrip, truck_id: e.target.value})}
                  >
                    <option value="">Select Truck</option>
                    {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Odometer</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={editingTrip.start_odometer || 0}
                    onChange={e => setEditingTrip({...editingTrip, start_odometer: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Odometer</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={editingTrip.end_odometer || 0}
                    onChange={e => setEditingTrip({...editingTrip, end_odometer: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                  value={editingTrip.status}
                  onChange={e => setEditingTrip({...editingTrip, status: e.target.value as any})}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <button 
                onClick={handleUpdateTrip}
                disabled={isSaving || !editingTrip.route_name || !editingTrip.driver_id || !editingTrip.truck_id}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Update Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripManagement;
