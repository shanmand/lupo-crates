
import React, { useState, useRef } from 'react';
import { Truck as TruckIcon, MapPin, ClipboardList, CheckCircle2, AlertTriangle, ArrowRight, User as UserIcon, Package, Zap, Camera, FileText, Trash2, X, UserCheck, ShieldAlert, Lock, Info, History as HistoryIcon } from 'lucide-react';
import { MOCK_BATCHES, MOCK_LOCATIONS, MOCK_ASSETS, MOCK_INVENTORY, MOCK_MOVEMENTS, MOCK_TRUCKS, MOCK_DRIVERS } from '../constants';
import { MovementCondition, LocationType, AssetType, User as UserType, UserRole, Location, Batch, Truck as TruckType, Driver, AssetMaster, BatchMovement, MovementDestination, Trip, TripStop } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { normalizePayload, castId } from '../supabaseUtils';

interface LogisticsOpsProps {
  currentUser: UserType;
  initialCollectionRequest?: {
    customerId: string;
    assetId: string;
    quantity: number;
    requestId?: string;
  };
}

const LogisticsOps: React.FC<LogisticsOpsProps> = ({ currentUser, initialCollectionRequest }) => {
  const isReadOnly = currentUser.role === UserRole.EXECUTIVE;
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [origins, setOrigins] = useState<MovementDestination[]>([]);
  const [destinations, setDestinations] = useState<MovementDestination[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assetsMaster, setAssetsMaster] = useState<AssetMaster[]>([]);
  const [activeShifts, setActiveShifts] = useState<{driver_id: string, truck_id: string}[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState(''); 
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [assets, setAssets] = useState<{ assetId: string, quantity: number, batchId?: string }[]>([]);
  const [condition, setCondition] = useState(MovementCondition.CLEAN);
  const [routeInstructions, setRouteInstructions] = useState('');
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [thaanFile, setThaanFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [errors, setErrors] = useState<string[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'alert'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setLocations(MOCK_LOCATIONS);
      setOrigins(MOCK_LOCATIONS.map(l => ({
        id: l.id,
        name: l.name,
        partner_type: l.partner_type,
        display_name: `${l.name} (${l.partner_type})`,
        sort_group: l.category === 'Home' ? 1 : (l.type === LocationType.IN_TRANSIT ? 3 : 2),
        type: l.type,
        category: l.category
      })));
      setDestinations(MOCK_LOCATIONS.map(l => ({
        id: l.id,
        name: l.name,
        partner_type: l.partner_type,
        display_name: `${l.name} (${l.partner_type})`,
        type: l.type,
        category: l.category
      })));
      setBatches(MOCK_BATCHES);
      setTrucks(MOCK_TRUCKS);
      setDrivers(MOCK_DRIVERS);
      setAssetsMaster(MOCK_ASSETS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('LogisticsOps: Fetching data...');
      const [locsRes, originsRes, destsRes, batchesRes, trucksRes, driversRes, assetsRes, shiftsRes, tripsRes] = await Promise.all([
        supabase.from('vw_all_sources').select('*'),
        supabase.from('vw_all_origins').select('*'),
        supabase.from('vw_movement_destinations').select('*'),
        supabase.from('batches').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('asset_master').select('*'),
        supabase.from('driver_shifts').select('driver_id, truck_id').is('end_time', null),
        supabase.from('trips').select('*').in('status', ['Planned', 'In Progress'])
      ]);

      console.log('LogisticsOps Data Received:', {
        sources: locsRes.data?.length,
        origins: originsRes.data?.length,
        destinations: destsRes.data?.length,
        batches: batchesRes.data?.length,
        trucks: trucksRes.data?.length,
        drivers: driversRes.data?.length
      });

      if (originsRes.data) {
        console.log('Origins Sample:', originsRes.data.slice(0, 3));
        console.log('Origins Types:', [...new Set(originsRes.data.map(o => o.type))]);
      }

      if (shiftsRes.data) setActiveShifts(shiftsRes.data);
      if (tripsRes.data) setTrips(tripsRes.data);
      if (locsRes.data) {
        const uniqueLocs = Array.from(new Map(locsRes.data.map(item => [item.id, item])).values());
        setLocations(uniqueLocs as any);
      }
      if (originsRes.data) {
        const uniqueOrigins = Array.from(new Map(originsRes.data.map(item => [item.id, item])).values());
        setOrigins(uniqueOrigins);
        if (uniqueOrigins.length > 0) {
          setOrigin(uniqueOrigins[0].id);
        }
      }
      if (destsRes.data) {
        const uniqueDests = Array.from(new Map(destsRes.data.map(item => [item.id, item])).values());
        setDestinations(uniqueDests);
        if (uniqueDests.length > 0) {
          setDestination(uniqueDests[0].id);
        }
      }
      if (batchesRes.data) {
        const uniqueBatches = Array.from(new Map(batchesRes.data.map(item => [item.id, item])).values());
        setBatches(uniqueBatches);
      }
      if (trucksRes.data) {
        setTrucks(trucksRes.data);
        if (trucksRes.data.length > 0) setTruckId(trucksRes.data[0].id);
      }
      if (driversRes.data) {
        setDrivers(driversRes.data);
        if (driversRes.data.length > 0) setDriverId(driversRes.data[0].id);
      }
      if (assetsRes.data) {
        setAssetsMaster(assetsRes.data);
        if (assetsRes.data.length > 0) setAssets([{ assetId: assetsRes.data[0].id, quantity: 0 }]);
      }
    } catch (err) {
      console.error("Error fetching logistics data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  React.useEffect(() => {
    if (initialCollectionRequest && locations.length > 0) {
      setOrigin(initialCollectionRequest.customerId);
      setIsInternal(false);
      
      // Pre-fill destination to the first Home location
      const homeLoc = locations.find(l => l.category === 'Home');
      if (homeLoc) setDestination(homeLoc.id);

      // Try to find a batch at the origin for this asset
      const matchingBatch = batches.find(b => 
        b.current_location_id === initialCollectionRequest.customerId && 
        b.asset_id === initialCollectionRequest.assetId
      );

      setAssets([{ 
        assetId: initialCollectionRequest.assetId, 
        quantity: initialCollectionRequest.quantity,
        batchId: matchingBatch?.id
      }]);
    }
  }, [initialCollectionRequest, locations, batches]);

  const handleAddAsset = () => !isReadOnly && assetsMaster.length > 0 && setAssets([...assets, { assetId: assetsMaster[0].id, quantity: 0 }]);
  const handleRemoveAsset = (index: number) => !isReadOnly && setAssets(assets.filter((_, i) => i !== index));
  const handleAssetChange = (index: number, field: 'assetId' | 'quantity' | 'batchId', value: any) => {
    if (isReadOnly) return;
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    setAssets(newAssets);
  };

  const handleDriverChange = (id: string) => {
    setDriverId(id);
    const shift = activeShifts.find(s => s.driver_id === id);
    if (shift) {
      setTruckId(shift.truck_id);
    }
  };

  const handleTripChange = async (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedStopId('');
    if (tripId) {
      const { data } = await supabase
        .from('trip_stops')
        .select('*')
        .eq('trip_id', tripId)
        .order('sequence_number', { ascending: true });
      if (data) setTripStops(data);
      
      const trip = trips.find(t => t.id === tripId);
      if (trip) {
        setDriverId(trip.driver_id);
        setTruckId(trip.truck_id);
      }
    } else {
      setTripStops([]);
    }
  };

  const handleCaptureMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    
    setErrors([]);
    const validationErrors: string[] = [];
    if (assets.some(a => !a.batchId || a.batchId.trim() === "")) validationErrors.push("Please select a valid Batch Reference for all items.");
    if (assets.some(a => a.quantity <= 0)) validationErrors.push("All line items must have a quantity > 0.");
    if (origin === destination) validationErrors.push("Origin and Destination cannot be the same.");
    if (!destination) validationErrors.push("Destination is required.");
    
    if (!isInternal) {
      if (!truckId) validationErrors.push("Please select a truck.");
      if (!driverId) validationErrors.push("Please select a driver.");
    }
    
    const destSource = origins.find(s => s.id === destination) || destinations.find(s => s.id === destination);
    const isDestCustomer = destSource?.partner_type === 'Customer';
    const isDestInTransit = locations.find(l => l.id === destination)?.type === LocationType.IN_TRANSIT;

    if (isDestCustomer && !thaanFile) {
      validationErrors.push("Customer delivery requires a THAAN Slip upload.");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    let firstTargetBatchId: string | null = null;

    try {
      if (isSupabaseConfigured) {
        for (const item of assets) {
          const { data: batch, error: fetchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', item.batchId)
            .single();

          if (fetchError || !batch) throw new Error(`Could not find Batch ${item.batchId}`);
          if (batch.quantity < item.quantity) {
            throw new Error(`Insufficient quantity in Batch ${item.batchId}. Available: ${batch.quantity}`);
          }

          let targetBatchId = item.batchId;

          // Handle Partial Movement
          if (item.quantity < batch.quantity) {
            // Use RPC to split the batch atomically
            const { data: newBatchId, error: splitError } = await supabase.rpc('split_batch', normalizePayload({
              original_batch_id: item.batchId,
              move_qty: item.quantity,
              new_location_id: destination,
              move_date: movementDate
            }));

            if (splitError) throw splitError;
            if (!newBatchId) throw new Error("Failed to generate new batch ID during split");
            
            console.log("Split RPC Result:", newBatchId);
            targetBatchId = castId(newBatchId);
            console.log("Target Batch ID after cast:", targetBatchId);
          } else {
            // Full Movement
            const { error: updateError } = await supabase
              .from('batches')
              .update(normalizePayload({ 
                current_location_id: destination,
                status: isDestInTransit ? 'In-Transit' : 'Success',
                transaction_date: movementDate
              }))
              .eq('id', item.batchId);

            if (updateError) throw updateError;
          }

          if (!targetBatchId || typeof targetBatchId !== "string") {
            throw new Error(`Invalid batch_id for item ${item.batchId}. Movement cannot be recorded.`);
          }

          // Verify the batch exists before insert
          const { data: batchExists, error: existError } = await supabase
            .from("batches")
            .select("id")
            .eq("id", targetBatchId)
            .single();

          if (existError || !batchExists) {
            throw new Error(`Batch ${targetBatchId} does not exist in the database.`);
          }

          if (!firstTargetBatchId) firstTargetBatchId = targetBatchId;

          // Record the movement
          const movementPayload = {
            batch_id: targetBatchId,
            from_location_id: origin,
            to_location_id: destination,
            truck_id: isInternal ? null : truckId,
            driver_id: isInternal ? null : driverId,
            trip_id: selectedTripId || null,
            trip_stop_id: selectedStopId || null,
            quantity: item.quantity,
            route_instructions: routeInstructions,
            timestamp: new Date(movementDate).toISOString(),
            transaction_date: movementDate,
            condition: condition,
            origin_user_id: currentUser.id
          };

          // Prevent empty inserts
          if (!movementPayload.batch_id) {
            throw new Error("Batch ID is missing. Cannot record movement.");
          }

          // Log payload before insert for debugging
          console.log("Movement payload:", movementPayload);

          const { error: moveError } = await supabase
            .from('batch_movements')
            .insert([normalizePayload(movementPayload)]);

          if (moveError) {
            console.error("Movement capture error:", moveError);
            throw moveError;
          }

          // Automated Claim Trigger for Dirty/Damaged assets
          if (condition !== MovementCondition.CLEAN && !isInternal) {
            const { error: claimError } = await supabase
              .from('claims')
              .insert([{
                id: `CLM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                batch_id: targetBatchId,
                truck_id: truckId,
                driver_id: driverId,
                type: condition === MovementCondition.DAMAGED ? 'Damaged' : 'Dirty',
                amount_claimed_zar: condition === MovementCondition.DAMAGED ? 150 : 25, // Mock amounts
                status: 'Lodged'
              }]);
            
            if (claimError) console.error("Claim auto-trigger error:", claimError);
          }
        }

        if (thaanFile && firstTargetBatchId) {
          const fileExt = thaanFile.name.split('.').pop();
          const fileName = `${firstTargetBatchId}-${Math.random()}.${fileExt}`;
          const filePath = `thaan-slips/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('thaan-slips')
            .upload(filePath, thaanFile);

          if (uploadError) {
            if (uploadError.message.includes('bucket not found')) {
              throw new Error("Storage bucket 'thaan-slips' not found. Please create it in your Supabase dashboard or run the SQL in the 'Schema & Migrations' tab.");
            }
            throw uploadError;
          }

          const { data: publicUrlData } = supabase.storage
            .from('thaan-slips')
            .getPublicUrl(filePath);

          await supabase
            .from('thaan_slips')
            .insert([{
              batch_id: firstTargetBatchId,
              doc_url: publicUrlData.publicUrl,
              is_signed: true,
              signed_at: new Date().toISOString()
            }]);
        }
      } else {
        // Mock success for development
        console.warn("Supabase not configured. Simulating movement capture success.");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setNotification({ message: "Manifest logged & batches updated successfully.", type: 'success' });
      
      // If this was from a collection request, mark it as completed
      if (initialCollectionRequest?.requestId) {
        await supabase
          .from('collection_requests')
          .update({ status: 'Completed' })
          .eq('id', initialCollectionRequest.requestId);
      }

      if (assetsMaster.length > 0) {
        setAssets([{ assetId: assetsMaster[0].id, quantity: 0 }]);
      }
      setThaanFile(null);
      setRouteInstructions('');
      fetchData(); // Refresh data
    } catch (err: any) {
      console.error("Movement capture error:", err);
      setNotification({ message: err.message || "Failed to record movement.", type: 'alert' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const selectedTruck = trucks.find(t => t.id === truckId);
  const selectedDriver = drivers.find(d => d.id === driverId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-center gap-4 animate-in fade-in">
          <ShieldAlert className="text-amber-500" size={24} />
          <div>
            <p className="text-sm font-bold text-amber-900 uppercase">Executive Read-Only Mode</p>
            <p className="text-xs text-amber-700 font-medium">Capture controls are disabled for your profile level. Operations must be logged by Crates Dept staff.</p>
          </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right max-w-md ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${isReadOnly ? 'opacity-60 cursor-not-allowed select-none' : ''}`}>
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest">Movement Manifest</h3>
              </div>
              <div className="flex items-center gap-4">
                {!isReadOnly && (
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Internal Transfer?</span>
                    <div 
                      onClick={() => setIsInternal(!isInternal)}
                      className={`w-10 h-5 rounded-full relative transition-all ${isInternal ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isInternal ? 'left-6' : 'left-1'}`} />
                    </div>
                  </label>
                )}
                {isReadOnly && <Lock size={14} className="text-slate-500" />}
              </div>
            </div>

            <form onSubmit={handleCaptureMovement} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <HistoryIcon size={14} className="text-indigo-500" /> Active Trip (Optional)
                  </span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                    value={selectedTripId}
                    onChange={e => handleTripChange(e.target.value)}
                  >
                    <option value="">No Trip Assigned</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.route_name} ({t.id})</option>)}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-500" /> Current Stop
                  </span>
                  <select 
                    disabled={isReadOnly || !selectedTripId}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none disabled:opacity-50"
                    value={selectedStopId}
                    onChange={e => setSelectedStopId(e.target.value)}
                  >
                    <option value="">{tripStops.length === 0 && selectedTripId ? "No stops found for this trip" : "Select Stop"}</option>
                    {tripStops.map(s => (
                      <option key={s.id} value={s.id}>
                        Stop {s.sequence_number}: {locations.find(l => l.id === s.location_id)?.name || `Location ID: ${s.location_id}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-500" /> Origin Location
                  </span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                  >
                    <optgroup label="Internal Facilities">
                      {origins.filter(o => o.partner_type === 'Internal' && o.type !== LocationType.IN_TRANSIT).map(o => <option key={`origin-home-${o.id}`} value={o.id}>{o.display_name}</option>)}
                    </optgroup>
                    <optgroup label="Customers & Partners">
                      {!isInternal && origins
                        .filter(o => o.category !== 'Home' && o.type !== LocationType.IN_TRANSIT)
                        .map(o => <option key={`origin-partner-${o.id}`} value={o.id}>{o.display_name}</option>)}
                    </optgroup>
                    <optgroup label="Trucks (In-Transit)">
                      {origins.filter(o => o.type === LocationType.IN_TRANSIT).map(o => <option key={`origin-transit-${o.id}`} value={o.id}>{o.display_name}</option>)}
                    </optgroup>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14} className="text-rose-500" /> Destination
                  </span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                  >
                    <optgroup label="Internal Facilities">
                      {destinations.filter(d => d.partner_type === 'Internal' && d.type !== LocationType.IN_TRANSIT).map(d => <option key={`dest-home-${d.id}`} value={d.id}>{d.display_name}</option>)}
                    </optgroup>
                    <optgroup label="Customers & Partners">
                      {!isInternal && destinations
                        .filter(d => d.category !== 'Home' && d.type !== LocationType.IN_TRANSIT)
                        .map(d => <option key={`dest-partner-${d.id}`} value={d.id}>{d.display_name}</option>)}
                    </optgroup>
                    <optgroup label="Trucks (In-Transit)">
                      {destinations.filter(d => d.type === LocationType.IN_TRANSIT).map(d => <option key={`dest-transit-${d.id}`} value={d.id}>{d.display_name}</option>)}
                    </optgroup>
                  </select>
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Assets & Quantities</span>
                    <p className="text-[10px] text-slate-400 font-medium">Select batches currently located at the Origin</p>
                  </div>
                  {!isReadOnly && <button type="button" onClick={handleAddAsset} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase tracking-widest">Add Row</button>}
                </div>
                <div className="space-y-3">
                  {assets.map((a, idx) => {
                    const availableBatches = batches.filter(b => b.current_location_id === origin);
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <select 
                            disabled={isReadOnly}
                            className={`flex-1 border rounded-xl p-3 text-sm bg-white outline-none transition-all ${!a.batchId ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}
                            value={a.batchId || ''}
                            onChange={e => handleAssetChange(idx, 'batchId', e.target.value)}
                          >
                            <option value="">Select Batch at Origin</option>
                            {availableBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.id} — {assetsMaster.find(am => am.id === b.asset_id)?.name} ({b.quantity} available)
                              </option>
                            ))}
                          </select>
                          <input 
                            disabled={isReadOnly}
                            type="number" 
                            placeholder="Qty"
                            className="w-32 border border-slate-200 rounded-xl p-3 text-sm bg-white outline-none"
                            value={a.quantity || ''}
                            onChange={e => handleAssetChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          />
                          {!isReadOnly && assets.length > 1 && (
                            <button type="button" onClick={() => handleRemoveAsset(idx)} className="p-3 text-slate-300 hover:text-rose-500">
                              <X size={18} />
                            </button>
                          )}
                        </div>
                        {availableBatches.length === 0 && (
                          <p className="text-[9px] text-rose-500 font-bold uppercase px-1">
                            No batches found at this origin. Use "Inventory Intake" to create one.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isReadOnly && (
                <>
                  <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-6 transition-all">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><TruckIcon size={14} /> Select Truck</h4>
                      <select 
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                        value={truckId}
                        onChange={e => setTruckId(e.target.value)}
                      >
                        <option value="">Select Truck</option>
                        {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><UserIcon size={14} /> Select Driver</h4>
                      <select 
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                        value={driverId}
                        onChange={e => handleDriverChange(e.target.value)}
                      >
                        <option value="">Select Driver</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><ClipboardList size={14} /> Movement Date</h4>
                      <input 
                        type="date"
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                        value={movementDate}
                        onChange={e => setMovementDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Route & Instructions */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-slate-400" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Route & Instructions</h4>
                    </div>
                    <textarea 
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px]"
                      placeholder="Enter specific route details or delivery instructions..."
                      value={routeInstructions}
                      onChange={e => setRouteInstructions(e.target.value)}
                    />
                  </div>

                  {/* Condition Selection */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="text-slate-400" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Asset Condition on Receipt/Dispatch</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[MovementCondition.CLEAN, MovementCondition.DIRTY, MovementCondition.DAMAGED].map((cond) => (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => setCondition(cond)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            condition === cond 
                              ? cond === MovementCondition.CLEAN ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                                cond === MovementCondition.DIRTY ? 'border-amber-500 bg-amber-50 text-amber-700' :
                                'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            condition === cond
                              ? cond === MovementCondition.CLEAN ? 'bg-emerald-500 text-white' :
                                cond === MovementCondition.DIRTY ? 'bg-amber-500 text-white' :
                                'bg-rose-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {cond === MovementCondition.CLEAN ? <CheckCircle2 size={16} /> : 
                             cond === MovementCondition.DIRTY ? <Zap size={16} /> : 
                             <AlertTriangle size={16} />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{cond}</span>
                        </button>
                      ))}
                    </div>
                    {condition !== MovementCondition.CLEAN && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-center gap-3">
                        <Info size={14} className="text-amber-600" />
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">
                          Flagging as {condition} will automatically trigger a supplier claim for reconciliation.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* THAAN Slip Upload Section - Always visible for better UX */}
                  <div className={`p-6 rounded-2xl border transition-all space-y-4 ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">THAAN Slip / Proof of Delivery</h4>
                            {locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER && (
                              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded uppercase tracking-widest animate-pulse">Required</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Upload signed manifest or delivery note</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-slate-800 text-white hover:bg-slate-700 shadow-slate-200'}`}
                      >
                        {thaanFile ? 'Change File' : 'Upload Slip'}
                      </button>
                    </div>
                    
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={e => setThaanFile(e.target.files?.[0] || null)}
                    />

                    {thaanFile && (
                      <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-slate-200 shadow-inner">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                            <CheckCircle2 size={14} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{thaanFile.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setThaanFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {errors.length > 0 && (
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-1">
                      {errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-rose-600"><AlertTriangle size={12} /> {err}</div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isSubmitting || assets.some(a => !a.batchId || a.quantity <= 0) || !origin || !destination}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? 'Syncing...' : 'RECORD MOVEMENT'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-4">Unit Summary</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><TruckIcon size={24} /></div>
              <div>
                <p className="text-lg font-bold text-slate-800 leading-none mb-1">{selectedTruck?.plate_number || 'Unassigned'}</p>
                <p className="text-xs text-slate-500">{selectedDriver?.full_name || 'No Driver'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsOps;
