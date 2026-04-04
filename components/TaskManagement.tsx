
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw,
  MoreVertical, 
  Trash2, 
  Pencil,
  Filter,
  ArrowUpDown,
  User as UserIcon,
  Loader2,
  X
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { normalizePayload } from '../supabaseUtils';
import BranchSelector from './BranchSelector';
import { Task, User, Location } from '../types';
import { useUser } from '../UserContext';
import { formatDateTime } from '../constants';

interface Personnel {
  id: string;
  name: string;
  role: string;
  type: 'User' | 'Driver';
  branch_id?: string;
}

interface TaskManagementProps {
  onStartStockTake?: (locationId: string) => void;
}

const TaskManagement: React.FC<TaskManagementProps> = ({ onStartStockTake }) => {
  const { profile } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'User' | 'Driver'>('User');
  const [quickAddName, setQuickAddName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'Pending' as const,
    priority: 'Medium' as const,
    due_date: new Date().toISOString().slice(0, 16),
    assigned_to: '',
    branch_id: '',
    task_type: 'General' as 'General' | 'Stock Take',
    location_id: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [tasksRes, usersRes, locsRes, personnelRes] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*'),
        supabase.from('locations').select('*').order('name'),
        supabase.from('vw_assignable_personnel').select('*')
      ]);

      if (tasksRes.error) {
        if (tasksRes.error.code === '42P01' || tasksRes.status === 404) {
          setError('DATABASE_SETUP_REQUIRED');
        } else {
          throw tasksRes.error;
        }
      }
      
      if (tasksRes.data) setTasks(tasksRes.data);
      if (locsRes.data) setLocations(locsRes.data);
      if (personnelRes.data) setPersonnel(personnelRes.data);
      if (usersRes.data) {
        setUsers(usersRes.data.map((u: any) => ({
          id: u.id,
          name: u.full_name,
          role: u.role_name,
          branch_id: u.home_branch_name
        })));
      }
    } catch (err) {
      console.error("Task Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let finalDescription = newTask.description;

      // Auto-generate batch list for Stock Take tasks
      if (newTask.task_type === 'Stock Take' && newTask.location_id) {
        const { data: batches } = await supabase
          .from('batches')
          .select('id, quantity')
          .eq('current_location_id', newTask.location_id)
          .eq('status', 'Success');
        
        if (batches && batches.length > 0) {
          const batchList = batches.map(b => `- Batch #${b.id}: ${b.quantity} units`).join('\n');
          finalDescription = `${newTask.description}\n\nExpected Inventory:\n${batchList}`;
        } else {
          finalDescription = `${newTask.description}\n\n(No active batches found at this location)`;
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([normalizePayload({
          title: newTask.title,
          description: finalDescription,
          status: newTask.status,
          priority: newTask.priority,
          due_date: new Date(newTask.due_date).toISOString(),
          assigned_to: newTask.assigned_to || null,
          branch_id: newTask.branch_id || null,
          task_type: newTask.task_type,
          location_id: newTask.location_id || null
        })])
        .select();

      if (error) throw error;
      if (data) {
        setTasks(prev => [data[0], ...prev]);
        setIsTaskModalOpen(false);
        setNewTask({
          title: '',
          description: '',
          status: 'Pending',
          priority: 'Medium',
          due_date: new Date().toISOString().slice(0, 16),
          assigned_to: '',
          branch_id: '',
          task_type: 'General',
          location_id: ''
        });
      }
    } catch (err) {
      console.error("Create Task Error:", err);
      alert("Failed to create task. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editingTask.title,
          description: editingTask.description,
          status: editingTask.status,
          priority: editingTask.priority,
          due_date: new Date(editingTask.due_date).toISOString(),
          assigned_to: editingTask.assigned_to || null
        })
        .eq('id', editingTask.id);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
      setIsEditing(false);
      setEditingTask(null);
    } catch (err) {
      console.error("Update Task Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Delete Task Error:", err);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName) return;
    setIsLoading(true);
    try {
      if (quickAddType === 'Driver') {
        const id = `DRV-${Math.floor(1000 + Math.random() * 9000)}`;
        const { error } = await supabase.from('drivers').insert([{ id, full_name: quickAddName }]);
        if (error) throw error;
      } else {
        // For User, we'd normally need auth, but for "Quick Add" in this context, 
        // we'll just add to public.users if possible or alert that auth is needed.
        // Assuming we can insert into public.users for this demo/app structure
        const id = crypto.randomUUID();
        const { error } = await supabase.from('users').insert([{ id, full_name: quickAddName, email: `${quickAddName.toLowerCase().replace(' ', '.')}@shuku.internal` }]);
        if (error) throw error;
      }
      await fetchData();
      setIsQuickAddModalOpen(false);
      setQuickAddName('');
    } catch (err: any) {
      console.error("Quick Add Error:", err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const selectedBranch = isTaskModalOpen ? newTask.branch_id : editingTask?.branch_id;
    if (!selectedBranch) return locations;
    return locations.filter(l => l.branch_id === selectedBranch);
  }, [locations, newTask.branch_id, editingTask?.branch_id, isTaskModalOpen]);

  const filteredAndSortedTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }, [tasks, searchQuery, statusFilter, sortOrder]);

  if (error === 'DATABASE_SETUP_REQUIRED') {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
          <AlertTriangle size={40} />
        </div>
        <div className="space-y-4">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Database Setup Required</h3>
          <p className="text-slate-500 font-medium max-w-md mx-auto">
            The <strong>tasks</strong> table was not found in your database. This is common after a schema update.
          </p>
        </div>
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to fix:</p>
          <ol className="text-xs text-slate-600 space-y-3 font-bold list-decimal pl-4">
            <li>Go to the <strong>Data Schema</strong> tab in this app.</li>
            <li>Select the <strong>SQL Migrations</strong> view.</li>
            <li>Copy the SQL code under <strong>"13. Create Tasks Table"</strong>.</li>
            <li>Paste and run it in your <strong>Supabase SQL Editor</strong>.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>
        <button 
          onClick={() => { setError(null); fetchData(); }}
          className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto"
        >
          <RefreshCw size={18} /> I'VE RUN THE SQL, REFRESH NOW
        </button>
      </div>
    );
  }

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Task Management</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Operational To-Dos & Deadlines</p>
        </div>
        <button 
          onClick={() => setIsTaskModalOpen(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <Plus size={18} /> CREATE NEW TASK
        </button>
      </div>

      {/* Filters & Sorting */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            <ArrowUpDown size={14} /> Due Date {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedTasks.map(task => (
          <div key={task.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                task.priority === 'High' ? 'bg-rose-100 text-rose-600' :
                task.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                'bg-emerald-100 text-emerald-600'
              }`}>
                {task.priority} Priority
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingTask(task); setIsEditing(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            
            <h4 className="font-black text-slate-900 mb-2">{task.title}</h4>
            <p className="text-xs text-slate-500 mb-6 line-clamp-2">{task.description || 'No description provided.'}</p>
            
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} /> Due: {formatDateTime(task.due_date)}
                </div>
                <div className={`flex items-center gap-1 ${
                  task.status === 'Completed' ? 'text-emerald-500' :
                  task.status === 'In Progress' ? 'text-blue-500' :
                  'text-amber-500'
                }`}>
                  {task.status === 'Completed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {task.status}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                    {personnel.find(p => p.id === task.assigned_to)?.name.charAt(0) || <UserIcon size={12} />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {personnel.find(p => p.id === task.assigned_to)?.name || 'Unassigned'}
                  </span>
                </div>
                {task.task_type === 'Stock Take' && task.location_id && task.status !== 'Completed' && (
                  <button 
                    onClick={() => onStartStockTake?.(task.location_id!)}
                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    Start Task &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {(isTaskModalOpen || isEditing) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                {isTaskModalOpen ? 'Create New Task' : 'Edit Task'}
              </h4>
              <button onClick={() => { setIsTaskModalOpen(false); setIsEditing(false); }} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={isTaskModalOpen ? handleCreateTask : handleUpdateTask} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Title</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={isTaskModalOpen ? newTask.title : editingTask?.title}
                  onChange={e => isTaskModalOpen ? setNewTask({...newTask, title: e.target.value}) : setEditingTask({...editingTask!, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={isTaskModalOpen ? newTask.description : editingTask?.description}
                  onChange={e => isTaskModalOpen ? setNewTask({...newTask, description: e.target.value}) : setEditingTask({...editingTask!, description: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Type</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isTaskModalOpen ? newTask.task_type : (editingTask as any)?.task_type}
                    onChange={e => isTaskModalOpen ? setNewTask({...newTask, task_type: e.target.value as any}) : setEditingTask({...editingTask!, task_type: e.target.value as any} as any)}
                  >
                    <option value="General">General</option>
                    <option value="Stock Take">Stock Take</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isTaskModalOpen ? newTask.priority : editingTask?.priority}
                    onChange={e => isTaskModalOpen ? setNewTask({...newTask, priority: e.target.value as any}) : setEditingTask({...editingTask!, priority: e.target.value as any})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              {((isTaskModalOpen && newTask.task_type === 'Stock Take') || (!isTaskModalOpen && editingTask?.task_type === 'Stock Take')) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Location</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isTaskModalOpen ? newTask.location_id : editingTask?.location_id}
                    onChange={e => isTaskModalOpen ? setNewTask({...newTask, location_id: e.target.value}) : setEditingTask({...editingTask!, location_id: e.target.value})}
                  >
                    <option value="">Select Location...</option>
                    {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date & Time</label>
                  <input 
                    required
                    type="datetime-local"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isTaskModalOpen ? newTask.due_date : (editingTask?.due_date ? new Date(editingTask.due_date).toISOString().slice(0, 16) : '')}
                    onChange={e => isTaskModalOpen ? setNewTask({...newTask, due_date: e.target.value}) : setEditingTask({...editingTask!, due_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assignee</label>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                      value={isTaskModalOpen ? newTask.assigned_to : editingTask?.assigned_to}
                      onChange={e => isTaskModalOpen ? setNewTask({...newTask, assigned_to: e.target.value}) : setEditingTask({...editingTask!, assigned_to: e.target.value})}
                    >
                      <option value="">Unassigned</option>
                      {personnel
                        .filter(p => !newTask.branch_id || p.branch_id === newTask.branch_id)
                        .map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setIsQuickAddModalOpen(true)}
                      className="p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={isTaskModalOpen ? newTask.status : editingTask?.status}
                  onChange={e => isTaskModalOpen ? setNewTask({...newTask, status: e.target.value as any}) : setEditingTask({...editingTask!, status: e.target.value as any})}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch</label>
                <BranchSelector 
                  value={isTaskModalOpen ? newTask.branch_id : (editingTask as any)?.branch_id}
                  onChange={val => isTaskModalOpen ? setNewTask({...newTask, branch_id: val}) : setEditingTask({...editingTask!, branch_id: val} as any)}
                  placeholder="Select Branch..."
                />
              </div>
              
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4"
              >
                {isTaskModalOpen ? 'CREATE TASK' : 'SAVE CHANGES'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Quick Add Modal */}
      {isQuickAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-black text-sm text-slate-900 uppercase tracking-widest">Quick Add Personnel</h4>
              <button onClick={() => setIsQuickAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleQuickAdd} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setQuickAddType('User')}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${quickAddType === 'User' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                  >
                    User
                  </button>
                  <button 
                    type="button"
                    onClick={() => setQuickAddType('Driver')}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${quickAddType === 'Driver' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                  >
                    Driver
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={quickAddName}
                  onChange={e => setQuickAddName(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-3 rounded-xl hover:bg-slate-800 transition-all text-xs uppercase tracking-widest"
              >
                ADD TO REGISTRY
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
