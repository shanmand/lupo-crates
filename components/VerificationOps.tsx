
import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_BATCHES, MOCK_LOCATIONS, MOCK_MOVEMENTS, MOCK_ASSETS, MOCK_USERS } from '../constants';
import { CheckCircle2, AlertTriangle, Truck, MapPin, Search, Zap, Package, UserCheck, XCircle, History as HistoryIcon, Calculator, ClipboardCheck, Loader2 } from 'lucide-react';
import { Batch, User as UserType, MovementCondition, BatchMovement, Truck as TruckType, Driver, AssetMaster } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface VerificationOpsProps {
  currentUser: UserType;
}

const VerificationOps: React.FC<VerificationOpsProps> = ({ currentUser }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setBatches([]);
        setMovements([]);
        setTrucks([]);
        setDrivers([]);
        setAssets([]);
        setUsers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [bRes, mRes, tRes, dRes, aRes, uRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('batch_movements').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('users').select('*')
        ]);

        if (bRes.data) setBatches(bRes.data);
        if (mRes.data) setMovements(mRes.data);
        if (tRes.data) setTrucks(tRes.data);
        if (dRes.data) setDrivers(dRes.data);
        if (aRes.data) setAssets(aRes.data);
        if (uRes.data) setUsers(uRes.data);
      } catch (err) {
        console.error("Verification Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Batches currently "In Transit" destined for the user's branch
  const incomingBatches = useMemo(() => {
    return batches.filter(b => {
      const lastMovement = movements
        .filter(m => m.batch_id === b.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      // Filter for batches coming to this specific user's branch
      return b.status === 'In-Transit' || (lastMovement && lastMovement.to_location_id === currentUser.branch_id && b.status === 'Pending');
    });
  }, [currentUser.branch_id, batches, movements]);

  const selectedBatch = incomingBatches.find(b => b.id === selectedBatchId);
  const lastMovement = selectedBatch ? movements.filter(m => m.batch_id === selectedBatch.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
  const dispatcher = lastMovement ? users.find(u => u.id === lastMovement.origin_user_id) : null;
  const truck = lastMovement?.truck_id ? trucks.find(t => t.id === lastMovement.truck_id) : null;
  const driver = lastMovement?.driver_id ? drivers.find(d => d.id === lastMovement.driver_id) : null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    setIsProcessing(true);
    const variance = receivedQty - selectedBatch.quantity;
    
    try {
      if (isSupabaseConfigured) {
        // Update batch status and quantity if needed
        const { error: updateError } = await supabase
          .from('batches')
          .update({ 
            status: 'Success',
            quantity: receivedQty // Update to physical count
          })
          .eq('id', selectedBatch.id);

        if (updateError) throw updateError;

        // Log audit if variance
        if (variance !== 0) {
          await supabase.from('audit_logs').insert([{
            user_id: currentUser.id,
            action: 'QUANTITY_VARIANCE_REPORTED',
            entity_type: 'Batch',
            entity_id: selectedBatch.id,
            old_value: selectedBatch.quantity.toString(),
            new_value: receivedQty.toString(),
            timestamp: new Date().toISOString()
          }]);

          // NEW: Create a Claim automatically for the variance
          // We need to find the thaan slip if it exists
          const { data: thaanData } = await supabase
            .from('thaan_slips')
            .select('id')
            .eq('batch_id', selectedBatch.id)
            .single();

          await supabase.from('claims').insert([{
            batch_id: selectedBatch.id,
            truck_id: truck?.id || 'TRK-UNKNOWN',
            driver_id: driver?.id || 'DRV-UNKNOWN',
            thaan_slip_id: thaanData?.id || 'THN-UNKNOWN',
            type: variance < 0 ? 'Damaged' : 'Dirty', // Using Damaged as proxy for missing/shortage
            amount_claimed_zar: Math.abs(variance) * 250, // Mock penalty per unit
            status: 'Lodged',
            created_at: new Date().toISOString()
          }]);
        }
      }

      setSuccessMsg(`Verification Logged. ${variance !== 0 ? `Variance of ${variance} reported for accountability.` : 'Batch matched system count.'}`);
      setSelectedBatchId('');
      setReceivedQty(0);
      setNotes('');
      
      // Refresh data
      if (isSupabaseConfigured) {
        const { data: bRes } = await supabase.from('batches').select('*');
        if (bRes) setBatches(bRes);
      }
    } catch (err) {
      console.error("Verification Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-500 rounded-full text-white"><CheckCircle2 size={24} /></div>
            <div>
               <p className="text-sm font-black text-emerald-900 uppercase">Verification Successful</p>
               <p className="text-xs text-emerald-700">{successMsg}</p>
            </div>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600"><XCircle size={20} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest text-white">Intake Intake Terminal</h3>
              </div>
              <div className="text-[10px] font-black uppercase bg-slate-800 px-3 py-1 rounded text-emerald-400 border border-slate-700">
                Live Verification
              </div>
            </div>

            <form onSubmit={handleVerify} className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Search size={14} /> Select Arriving Batch
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {incomingBatches.length > 0 ? incomingBatches.map(b => (
                     <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBatchId(b.id);
                          setReceivedQty(b.quantity);
                        }}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedBatchId === b.id ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}`}
                     >
                        <div className="flex justify-between items-start mb-2">
                           <p className="font-black text-slate-800">#{b.id}</p>
                           <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded shadow-sm text-slate-500 uppercase">{b.quantity} Units</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{assets.find(a => a.id === b.asset_id)?.name}</p>
                     </button>
                   )) : (
                     <div className="col-span-2 py-10 text-center text-slate-400 italic text-sm">No incoming transit detected for this branch.</div>
                   )}
                </div>
              </div>

              {selectedBatch && (
                <div className="animate-in fade-in slide-in-from-bottom duration-300 space-y-8 pt-6 border-t border-slate-100">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Physical Count at Intake</label>
                         <div className="flex items-center gap-4">
                            <input 
                               type="number"
                               className={`w-full text-3xl font-black p-4 rounded-2xl border-2 outline-none focus:ring-4 transition-all ${receivedQty === selectedBatch.quantity ? 'border-emerald-500 bg-emerald-50 focus:ring-emerald-100 text-emerald-800' : 'border-rose-300 bg-rose-50 focus:ring-rose-100 text-rose-800'}`}
                               value={receivedQty}
                               onChange={(e) => setReceivedQty(parseInt(e.target.value) || 0)}
                            />
                            <div className="shrink-0 flex flex-col gap-1">
                               <button type="button" onClick={() => setReceivedQty(receivedQty + 1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600">+</button>
                               <button type="button" onClick={() => setReceivedQty(Math.max(0, receivedQty - 1))} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600">-</button>
                            </div>
                         </div>
                         {receivedQty !== selectedBatch.quantity && (
                           <p className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-1 animate-pulse">
                             <AlertTriangle size={12} /> Variance detected: {receivedQty - selectedBatch.quantity} units
                           </p>
                         )}
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Calculator size={14} /> Intake Forensic Preview
                         </h4>
                         <div className="space-y-3">
                            <div className="flex justify-between">
                               <span className="text-xs text-slate-500">Sender Identity</span>
                               <span className="text-xs font-bold text-slate-700">{dispatcher?.name || 'System'}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-xs text-slate-500">Transporter Unit</span>
                               <span className="text-xs font-bold text-slate-700">{truck?.plate_number || 'Direct Transfer'}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-xs text-slate-500">Driver</span>
                               <span className="text-xs font-bold text-slate-700">{driver?.full_name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2">
                               <span className="text-xs text-slate-500">Expected Liability</span>
                               <span className="text-xs font-bold text-slate-900">{selectedBatch.quantity} Assets</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Verification Observations</label>
                      <textarea 
                        className="w-full h-24 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Note any damage or delivery notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                   </div>

                   <button 
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 flex items-center justify-center gap-3 active:scale-95"
                   >
                      {isProcessing ? 'Recording Audit...' : 'SIGN-OFF & RECEIVE BATCH'}
                      <Zap size={18} className="text-emerald-400" />
                   </button>
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                <UserCheck className="text-blue-500" size={16} /> Verifier Accountability
              </h4>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center font-black text-slate-900 text-sm">{currentUser.name.charAt(0)}</div>
                    <div>
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{currentUser.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{currentUser.role}</p>
                    </div>
                 </div>
                 <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-relaxed font-medium italic">
                    "By signing off, you acknowledge custody transfer. Any variances reported will trigger an automatic Forensic Audit entry attributed to your profile ID."
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                <HistoryIcon className="text-slate-400" size={16} /> Recent Branch Intake
              </h4>
              <div className="space-y-4">
                 {movements.slice(0, 3).map(m => (
                    <div key={m.id} className="flex justify-between items-center text-[11px] group">
                       <div className="flex items-center gap-2">
                          <Package size={12} className="text-slate-300" />
                          <span className="font-bold text-slate-600">#{m.batch_id}</span>
                       </div>
                       <span className="text-slate-400 font-bold uppercase">Success</span>
                    </div>
                 ))}
                 <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline w-full pt-2">Full Branch History</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationOps;
