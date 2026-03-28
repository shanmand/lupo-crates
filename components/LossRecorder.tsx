
import React, { useState, useEffect } from 'react';
import { Skull, AlertTriangle, Search, MapPin, Package, History, TrendingDown, Loader2, CheckCircle2, Plus, Calendar, ArrowRight, X, Database, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { User, Location, AssetMaster } from '../types';

interface LossRecorderProps {
  currentUser: User;
}

const LossRecorder: React.FC<LossRecorderProps> = ({ currentUser }) => {
  const [losses, setLosses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLossModal, setShowLossModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Loss Form State
  const [lossForm, setLossForm] = useState({
    batch_id: '',
    lost_quantity: 0,
    loss_type: 'Missing',
    location_id: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [lossRes, batchRes, sourceRes, assetsRes] = await Promise.all([
        supabase.from('asset_losses').select('*').order('timestamp', { ascending: false }),
        supabase.from('batches').select('*, asset:asset_master(name)').eq('status', 'Success').gt('quantity', 0),
        supabase.from('vw_all_sources').select('*'),
        supabase.from('asset_master').select('id, name')
      ]);

      if (batchRes.data) setBatches(batchRes.data);
      if (sourceRes.data) setSources(sourceRes.data);
      
      if (lossRes.data && batchRes.data && sourceRes.data && assetsRes.data) {
        const losses = lossRes.data;
        const batches = batchRes.data;
        const locations = sourceRes.data;
        const assets = assetsRes.data;

        // Join data (replicating vw_loss_report)
        const joinedLosses = losses.map(al => {
          const batch = batches.find(b => b.id === al.batch_id);
          const asset = assets.find(a => a.id === batch?.asset_id);
          const location = locations.find(l => l.id === al.location_id);

          return {
            ...al,
            asset_name: asset?.name || 'Unknown Asset',
            location_name: location?.name || 'Unknown Location'
          };
        });

        setLosses(joinedLosses);
      }
    } catch (error) {
      console.error('Error fetching loss data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLossSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('process_asset_loss', {
        p_batch_id: lossForm.batch_id,
        p_lost_quantity: lossForm.lost_quantity,
        p_loss_type: lossForm.loss_type,
        p_location_id: lossForm.location_id,
        p_reported_by: currentUser.id,
        p_notes: lossForm.notes
      });

      if (error) throw error;

      setNotification({ message: `Loss recorded successfully. ID: ${data}`, type: 'success' });
      setShowLossModal(false);
      setLossForm({ batch_id: '', lost_quantity: 0, loss_type: 'Missing', location_id: '', notes: '' });
      fetchData();
    } catch (error: any) {
      setNotification({ message: error.message || 'Failed to process loss', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Losses</h1>
          <p className="text-slate-500 font-medium">Record and track asset discrepancies and write-offs</p>
        </div>
        <button 
          onClick={() => setShowLossModal(true)}
          className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 flex items-center gap-3"
        >
          <Skull size={18} /> Report New Loss
        </button>
      </div>

      {/* Loss History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20">
              <Skull size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Loss Forensics Log</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Audit trail of all asset write-offs</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loss Type</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty Lost</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {losses.map(loss => (
                <tr key={loss.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 font-black text-slate-900 text-sm">{loss.batch_id}</td>
                  <td className="px-8 py-4 text-xs font-bold text-slate-600">{loss.asset_name}</td>
                  <td className="px-8 py-4">
                    <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-black uppercase">
                      {loss.loss_type}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-black text-rose-600 text-sm">-{loss.lost_quantity}</td>
                  <td className="px-8 py-4 text-xs font-bold text-slate-700">{loss.location_name}</td>
                  <td className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase">
                    {new Date(loss.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 group-hover:text-slate-900 transition-colors">
                      <p className="text-[10px] font-medium text-slate-400 italic truncate max-w-[150px]">
                        {loss.notes || 'No notes'}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
              {losses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 italic text-sm">
                    No loss records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loss Modal */}
      {showLossModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skull size={20} className="text-rose-400" />
                <h3 className="font-black text-sm uppercase tracking-widest">Report Asset Loss</h3>
              </div>
              <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleLossSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Batch</label>
                <select 
                  required
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500"
                  value={lossForm.batch_id}
                  onChange={e => {
                    const batch = batches.find(b => b.id === e.target.value);
                    setLossForm({
                      ...lossForm, 
                      batch_id: e.target.value,
                      location_id: batch?.current_location_id || '',
                      lost_quantity: batch?.quantity || 0
                    });
                  }}
                >
                  <option value="">Choose Batch...</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.id} ({b.asset?.name} - {b.quantity} Units)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty Lost</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    max={batches.find(b => b.id === lossForm.batch_id)?.quantity || 1}
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500"
                    value={lossForm.lost_quantity || ''}
                    onChange={e => setLossForm({...lossForm, lost_quantity: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loss Type</label>
                  <select 
                    required
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500"
                    value={lossForm.loss_type}
                    onChange={e => setLossForm({...lossForm, loss_type: e.target.value})}
                  >
                    <option value="Missing">Missing / Lost</option>
                    <option value="Damaged">Damaged / Broken</option>
                    <option value="Theft">Theft / Stolen</option>
                    <option value="Customer Liable">Customer Liable</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident Location / Party</label>
                <select 
                  required
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500"
                  value={lossForm.location_id}
                  onChange={e => setLossForm({...lossForm, location_id: e.target.value})}
                >
                  <option value="">Select Node...</option>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Investigation Notes</label>
                <textarea 
                  required
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500 h-24 resize-none"
                  placeholder="Detail the investigation findings..."
                  value={lossForm.notes}
                  onChange={e => setLossForm({...lossForm, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !lossForm.batch_id}
                  className="flex-[2] bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Skull size={18} />}
                  Confirm Write-off
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
