
import React, { useState, useRef, useEffect } from 'react';
import { MOCK_BATCHES, MOCK_MOVEMENTS, MOCK_LOCATIONS, MOCK_FEES, MOCK_ASSETS, MOCK_THAANS } from '../constants';
import { Package, Truck as TruckIcon, Clock, MapPin, CheckCircle2, AlertCircle, FileText, Zap, History as HistoryIcon, Camera, UploadCloud, XCircle, User as UserIcon, ArrowLeft } from 'lucide-react';
import { FeeType, ThaanSlip, Batch, BatchMovement, Location, Truck as TruckType, Driver, AssetMaster, FeeSchedule, LogisticsTrace, MovementCondition } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useMasterData } from '../MasterDataContext';
import BatchFinancialDetailCard from './BatchFinancialDetailCard';
import ForensicTable from './ForensicTable';

const BatchTracker: React.FC<{ selectedBranchId?: string }> = ({ selectedBranchId: branchFilterId }) => {
  const { 
    locations, 
    trucks, 
    drivers, 
    personnel,
    assets: assetsMaster, 
    refreshAll 
  } = useMasterData();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [thaans, setThaans] = useState<ThaanSlip[]>([]);
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [traces, setTraces] = useState<LogisticsTrace[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>(isSupabaseConfigured ? [] : MOCK_FEES);
  
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatchDetail = async (batchId: string) => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      console.log('BatchTracker: Fetching detail for batch:', batchId);
      const [batchRes, thaanRes, movesRes, locations, parties] = await Promise.all([
        supabase.from('batches').select('*').eq('id', batchId).single(),
        supabase.from('thaan_slips').select('*').eq('batch_id', batchId),
        supabase.from('batch_movements').select('*').eq('batch_id', batchId),
        supabase.from('locations').select('*'),
        supabase.from('business_parties').select('*')
      ]);

      if (batchRes.data) {
        setBatches(prev => {
          const filtered = prev.filter(b => b.id !== batchId);
          return [...filtered, batchRes.data];
        });
      }
      if (thaanRes.data) setThaans(thaanRes.data);
      
      if (movesRes.data) {
        setMovements(movesRes.data);
        
        // Reconstruct traces client-side
        const allSources = [
          ...(locations.data || []).map(l => ({ ...l, type: 'Location' })),
          ...(parties.data || []).map(p => ({ ...p, type: 'Party' }))
        ];

        const reconstructedTraces = movesRes.data.map(bm => {
          const sTo = allSources.find(s => s.id === bm.to_location_id);
          const sFrom = allSources.find(s => s.id === bm.from_location_id);
          const driver = drivers.find(d => d.id === bm.driver_id);
          const truck = trucks.find(t => t.id === bm.truck_id);
          const person = personnel.find(p => p.id === bm.moved_by_id);
          
          return {
            movement_id: bm.id,
            batch_id: bm.batch_id,
            transaction_date: bm.transaction_date,
            timestamp: bm.timestamp,
            driver_name: driver?.full_name || null,
            moved_by_name: bm.moved_by_name || person?.name || null,
            quantity: bm.quantity || batchRes.data?.quantity,
            to_location_name: sTo?.name || 'Unknown',
            to_location_id: sTo?.id,
            from_location_name: sFrom?.name || 'Unknown',
            truck_plate: truck?.plate_number || null,
            condition: bm.condition,
            custodian_branch_id: sTo?.branch_id
          } as LogisticsTrace;
        });
        setTraces(reconstructedTraces);
      }
    } catch (err) {
      console.error("Error fetching batch detail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFees = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await supabase.from('fee_schedule').select('*');
      if (data) setFees(data);
    } catch (err) {
      console.error("Error fetching fees:", err);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  useEffect(() => {
    if (activeBatchId) {
      fetchBatchDetail(activeBatchId);
    }
  }, [activeBatchId]);

  const currentBatch = batches.find(b => String(b.id) === String(activeBatchId));
  const currentTraces = traces.filter(t => String(t.batch_id) === String(activeBatchId)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const asset = assetsMaster.find(a => a.id === currentBatch?.asset_id);
  const thaan = thaans.find(t => String(t.batch_id) === String(activeBatchId));

  const handleUploadThaan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBatchId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeBatchId}-${Math.random()}.${fileExt}`;
      const filePath = `thaan-slips/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('thaan-slips')
        .upload(filePath, file);

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from('thaan-slips')
        .getPublicUrl(filePath);

      const { data: newThaanRecord, error: dbError } = await supabase
        .from('thaan_slips')
        .insert([{
          batch_id: activeBatchId,
          doc_url: publicUrl,
          is_signed: true,
          signed_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      setThaans(prev => {
        const filtered = prev.filter(t => t.batch_id !== activeBatchId);
        return [...filtered, newThaanRecord as ThaanSlip];
      });

      setBatches(prev => prev.map(b => b.id === activeBatchId ? { ...b, status: 'Success' } : b));

    } catch (err: any) {
      setUploadError(err.message || "Failed to upload THAAN slip.");
    } finally {
      setIsUploading(false);
    }
  };

  const getFeeForBatch = () => {
    if (!currentBatch) return null;
    return fees.find(f => 
      f.asset_id === currentBatch.asset_id &&
      new Date(currentBatch.created_at) >= new Date(f.effective_from) &&
      (!f.effective_to || new Date(currentBatch.created_at) <= new Date(f.effective_to))
    );
  };

  const applicableFee = getFeeForBatch();
  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return <div className="p-20 text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Loading Batch Intelligence...</div>;
  }

  if (!activeBatchId) {
    return <ForensicTable selectedBranchId={branchFilterId} onSelectBatch={setActiveBatchId} />;
  }

  if (!currentBatch && batches.length > 0) {
    return (
      <div className="p-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
        <Package className="mx-auto text-slate-200 mb-4" size={48} />
        <h3 className="font-bold text-slate-800 uppercase tracking-widest">Batch Not Found</h3>
        <p className="text-sm text-slate-500 mt-2">The requested batch could not be located in the system.</p>
        <button onClick={() => setActiveBatchId(null)} className="mt-4 text-emerald-600 font-bold text-sm">Back to List</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setActiveBatchId(null)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 uppercase hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft size={14} /> Back to Forensic List
        </button>
        <div className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
          Batch Detail: #{activeBatchId}
        </div>
      </div>

      {currentBatch && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
                <HistoryIcon size={20} className="text-emerald-500" />
                Movement History
              </h3>

              <div className="relative pl-8 border-l-2 border-slate-100 space-y-12">
                {currentTraces.map((trace, idx) => {
                  return (
                    <div key={trace.movement_id} className="relative">
                      <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            On {new Date(trace.timestamp).toLocaleDateString('en-ZA')}, {trace.driver_name || trace.moved_by_name || 'System'} moved {trace.quantity} crates to {trace.to_location_name} {trace.truck_plate ? `using Truck ${trace.truck_plate}` : ''}
                          </p>
                          <h4 className="font-bold text-slate-800 text-lg mt-1">{trace.from_location_name} &rarr; {trace.to_location_name}</h4>
                          <div className="flex gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                              trace.condition === MovementCondition.CLEAN ? 'bg-emerald-100 text-emerald-700' : 
                              trace.condition === MovementCondition.DIRTY ? 'bg-amber-100 text-amber-700' : 
                              'bg-rose-100 text-rose-700'
                            }`}>{trace.condition}</span>
                            {trace.truck_plate && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><TruckIcon size={10} /> {trace.truck_plate}</span>}
                            {trace.driver_name && <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><UserIcon size={10} /> {trace.driver_name}</span>}
                            {trace.moved_by_name && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><UserIcon size={10} /> {trace.moved_by_name}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {(currentBatch.status === 'Success' || thaan?.is_signed) && (
                  <div className="relative">
                    <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center"><CheckCircle2 size={10} className="text-white" /></div>
                    <div>
                      <h4 className="font-bold text-emerald-600">Finalized - Delivery Confirmed</h4>
                      <p className="text-sm text-slate-500">All liability transferred to customer location.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <BatchFinancialDetailCard 
              batchId={activeBatchId} 
              onUpdate={() => activeBatchId && fetchBatchDetail(activeBatchId)} 
            />

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400" /> THAAN Slip</h3>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadThaan} />
              </div>
              
              {uploadError && (
                <div className="p-3 mb-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 flex items-center gap-2">
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}

              {thaan ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="aspect-[4/5] bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative group shadow-inner">
                    <img src={thaan.doc_url} alt="THAAN Slip" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold shadow-lg">Replace Image</button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-bold">Verified on {new Date(thaan.signed_at!).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-12 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 hover:bg-slate-100 hover:border-emerald-300 transition-all group"
                >
                  <UploadCloud className="mx-auto text-slate-300 group-hover:text-emerald-500 mb-2" size={32} />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{isUploading ? 'Uploading to Supabase...' : 'Upload Signed Slip'}</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchTracker;
