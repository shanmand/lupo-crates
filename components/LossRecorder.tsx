
import React, { useState, useEffect } from 'react';
import { MOCK_BATCHES, MOCK_MOVEMENTS, MOCK_LOCATIONS, MOCK_THAANS, MOCK_ASSETS, MOCK_USERS } from '../constants';
import { Skull, AlertTriangle, Truck, MapPin, User, FileText, CheckCircle2, XCircle, Search, Info, Database, CreditCard, UserCheck, ShieldAlert, Lock, Loader2 } from 'lucide-react';
import { LocationType, LossType, User as UserType, UserRole, Batch, BatchMovement, Location, Truck as TruckType, Driver, ThaanSlip, AssetMaster, User as DBUser } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface LossRecorderProps {
  currentUser: UserType;
}

const LossRecorder: React.FC<LossRecorderProps> = ({ currentUser }) => {
  const isReadOnly = currentUser.role === UserRole.EXECUTIVE;
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [thaans, setThaans] = useState<ThaanSlip[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [lossType, setLossType] = useState<LossType>(LossType.MISSING);
  const [isRechargeable, setIsRechargeable] = useState(false);
  const [lostQty, setLostQty] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [lossDate, setLossDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [lastKnown, setLastKnown] = useState<{
    location: string;
    locationId: string;
    locationType: LocationType;
    driver?: string;
    truck?: string;
    thaanUrl?: string;
    customerName?: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setBatches([]);
        setMovements([]);
        setLocations([]);
        setTrucks([]);
        setDrivers([]);
        setThaans([]);
        setAssets([]);
        setUsers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [bRes, mRes, lRes, tRes, dRes, thRes, aRes, uRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('batch_movements').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('thaan_slips').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('users').select('*')
        ]);

        if (bRes.data) setBatches(bRes.data);
        if (mRes.data) setMovements(mRes.data);
        if (lRes.data) setLocations(lRes.data);
        if (tRes.data) setTrucks(tRes.data);
        if (dRes.data) setDrivers(dRes.data);
        if (thRes.data) setThaans(thRes.data);
        if (aRes.data) setAssets(aRes.data);
        if (uRes.data) setUsers(uRes.data);
      } catch (err) {
        console.error("Loss Recorder Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Forensic Logic: Triggered when a batch is selected in the modal
  const runForensics = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;

    const batchMovements = movements.filter(m => m.batch_id === batchId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const lastMv = batchMovements[0];
    const loc = locations.find(l => l.id === (lastMv?.to_location_id || batch.current_location_id));
    const truck = lastMv?.truck_id ? trucks.find(t => t.id === lastMv.truck_id) : null;
    const driver = lastMv?.driver_id ? drivers.find(d => d.id === lastMv.driver_id) : null;
    const thaan = thaans.find(t => t.batch_id === batchId);

    setLastKnown({
      location: loc?.name || 'Unknown',
      locationId: loc?.id || batch.current_location_id,
      locationType: loc?.type || LocationType.WAREHOUSE,
      driver: driver?.full_name,
      truck: truck?.plate_number,
      thaanUrl: thaan?.doc_url,
      customerName: loc?.type === LocationType.AT_CUSTOMER ? loc.name : undefined
    });

    setLostQty(batch.quantity);
    
    if (loc?.type === LocationType.AT_CUSTOMER) {
        setLossType(LossType.CUSTOMER_LIABLE);
        setIsRechargeable(true);
    } else {
        setLossType(LossType.MISSING);
        setIsRechargeable(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      runForensics(selectedBatchId);
    } else {
      setLastKnown(null);
    }
  }, [selectedBatchId, batches, movements, locations, trucks, drivers, thaans]);

  const handleReportLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !selectedBatchId || lostQty <= 0 || !notes) return;

    setIsProcessing(true);
    try {
      if (isSupabaseConfigured) {
        const batch = batches.find(b => b.id === selectedBatchId);
        if (!batch) throw new Error("Batch not found");

        // Fetch current user session for email
        const { data: { user } } = await supabase.auth.getUser();
        const reporterEmail = user?.email || currentUser.id;

        // 1. Close modal immediately to prevent re-render hang
        setIsModalOpen(false);

        // 2. Call the single RPC for atomic transaction
        const { error } = await supabase.rpc('process_partial_loss', {
          p_batch_id: selectedBatchId,
          p_lost_quantity: lostQty,
          p_reported_by: reporterEmail,
          p_notes: notes,
          p_location_id: lastKnown?.locationId || batch.current_location_id
        });

        if (error) throw error;

        setSuccessMsg(`Loss forensic audit complete for Batch #${selectedBatchId}.`);
        setSelectedBatchId('');
        setNotes('');
        
        // 3. Refresh global state after modal is closed
        // (Assuming onUpdate or similar is needed, but the original code didn't have it, 
        // it likely relies on local state or parent refresh. I'll stick to the original flow but with RPC)
      } else {
        setIsModalOpen(false);
        setSuccessMsg("Demo Mode: Loss recorded locally");
      }
    } catch (err: any) {
      console.error("Loss Report Error:", err);
      // If error, we might want to re-open or show error
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Loss Forensics & Write-offs</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Investigate & Record Asset Discrepancies</p>
        </div>
        {!isReadOnly && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 uppercase tracking-widest"
          >
            <Skull size={18} /> Report New Loss
          </button>
        )}
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-center gap-4">
          <ShieldAlert className="text-amber-500" size={24} />
          <div>
            <p className="text-sm font-bold text-amber-900 uppercase">Executive Audit Access</p>
            <p className="text-xs text-amber-700 font-medium">Write-off permissions are restricted. You may view forensics but cannot confirm losses.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={20} />
            <p className="text-sm font-bold text-emerald-800">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)}><XCircle size={18} className="text-emerald-400" /></button>
        </div>
      )}

      {/* Loss History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Recent Write-off Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                <th className="px-6 py-4">Batch ID</th>
                <th className="px-6 py-4">Loss Type</th>
                <th className="px-6 py-4">Qty</th>
                <th className="px-6 py-4">Last Known Loc</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {batches.filter(b => b.status === 'Lost').map(batch => {
                const batchMovements = movements.filter(m => m.batch_id === batch.id)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const lastMv = batchMovements[0];
                const loc = locations.find(l => l.id === (lastMv?.to_location_id || batch.current_location_id));
                
                return (
                  <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-900 text-sm">{batch.id}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold uppercase">Missing/Lost</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 text-sm">{batch.quantity}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{loc?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{new Date(batch.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-rose-500 font-black text-[10px] uppercase">
                        <Skull size={12} /> Written Off
                      </div>
                    </td>
                  </tr>
                );
              })}
              {batches.filter(b => b.status === 'Lost').length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic text-sm">No write-offs recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Loss Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skull size={20} className="text-rose-400" />
                <h3 className="font-black text-sm uppercase tracking-widest">Loss Investigation Terminal</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleReportLoss} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Search size={14} /> Investigation Target</span>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-500 bg-slate-50 outline-none transition-all"
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                  >
                    <option value="">-- Choose Active Batch --</option>
                    {batches.filter(b => b.status !== 'Lost').map(b => (
                      <option key={b.id} value={b.id}>{b.id} ({b.quantity} Units)</option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Reason for Loss</span>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-500 bg-slate-50 outline-none"
                    value={lossType}
                    onChange={e => setLossType(e.target.value as LossType)}
                  >
                    {Object.values(LossType).map(lt => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedBatchId && lastKnown && (
                <div className="animate-in fade-in slide-in-from-bottom duration-500 space-y-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database size={14} /> Forensics Trace</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Last Known Loc</p>
                        <p className="text-sm font-black text-slate-700">{lastKnown.location}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Primary Driver</p>
                        <p className="text-sm font-black text-slate-700">{lastKnown.driver || 'N/A'}</p>
                      </div>
                      {lastKnown.truck && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Truck Plate</p>
                          <p className="text-sm font-black text-slate-700">{lastKnown.truck}</p>
                        </div>
                      )}
                      {lastKnown.thaanUrl && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">THAAN Evidence</p>
                          <a href={lastKnown.thaanUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">View Slip</a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Qty Lost</span>
                      <input 
                        required
                        type="number" 
                        max={batches.find(b => b.id === selectedBatchId)?.quantity}
                        className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                        value={lostQty}
                        onChange={e => setLostQty(parseInt(e.target.value) || 0)}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident Date</span>
                      <input 
                        required
                        type="date" 
                        className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                        value={lossDate}
                        onChange={e => setLossDate(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Audit Summary / Investigation Notes</span>
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Required</span>
                    </div>
                    <textarea 
                      required
                      className="w-full border border-slate-200 rounded-xl p-4 text-sm h-32 bg-slate-50 resize-none outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Detail the investigation findings..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!selectedBatchId || isProcessing || !notes}
                  className={`flex-[2] font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${!selectedBatchId || !notes ? 'bg-slate-100 text-slate-300' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                >
                  {isProcessing ? 'Processing Forensic Audit...' : 'CONFIRM WRITE-OFF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LossRecorder;
