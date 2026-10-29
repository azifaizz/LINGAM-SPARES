import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Flag, User, FileText, Loader2 } from 'lucide-react';
import { Staff, StaffTask, staffApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface StaffTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: Staff[];
  selectedStaffId?: string;
  initialTask?: StaffTask | null;
  onSuccess: () => void;
}

const StaffTaskModal: React.FC<StaffTaskModalProps> = ({
  isOpen,
  onClose,
  staffList,
  selectedStaffId,
  initialTask,
  onSuccess,
}) => {
  const tomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState(selectedStaffId || 'ALL');
  const [dueDate, setDueDate] = useState(tomorrowStr());
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setAssignedStaffId(initialTask.assignedStaffId || 'ALL');
      setDueDate(initialTask.dueDate || tomorrowStr());
      setPriority(initialTask.priority || 'MEDIUM');
    } else {
      setTitle('');
      setDescription('');
      setAssignedStaffId(selectedStaffId || (staffList[0]?.id || 'ALL'));
      setDueDate(tomorrowStr());
      setPriority('MEDIUM');
    }
  }, [initialTask, selectedStaffId, staffList, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title.');
      return;
    }

    const assignedStaff = assignedStaffId === 'ALL'
      ? null
      : staffList.find(s => s.id === assignedStaffId);

    setSaving(true);
    try {
      if (initialTask && initialTask.id) {
        await staffApi.updateTask(initialTask.id, {
          title: title.trim(),
          description: description.trim(),
          assignedStaffId,
          assignedStaffName: assignedStaffId === 'ALL' ? 'All Staff' : (assignedStaff?.name || ''),
          dueDate,
          priority,
        });
        toast.success('Task updated successfully!');
      } else {
        const payload: StaffTask = {
          title: title.trim(),
          description: description.trim(),
          assignedStaffId,
          assignedStaffName: assignedStaffId === 'ALL' ? 'All Staff' : (assignedStaff?.name || 'Staff'),
          dueDate,
          priority,
          status: 'PENDING',
        };
        await staffApi.createTask(payload);
        toast.success('Task appointed successfully!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save staff task', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to appoint task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <CheckSquare size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {initialTask ? 'Edit To-Do Task' : 'Appoint To-Do Task'}
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Assign actionable duties & responsibilities to staff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <CheckSquare size={14} className="text-emerald-500" /> Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Restock Switchboards aisle & update barcode labels"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-gray-400" /> Description / Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide specific guidelines or notes for this task..."
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Assignee & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-blue-500" /> Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedStaffId}
                onChange={(e) => setAssignedStaffId(e.target.value)}
                className="w-full form-select border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              >
                <option value="ALL">📢 All Staff Members</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-teal-500" /> Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Flag size={14} className="text-orange-500" /> Priority Level
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { level: 'LOW', label: 'Low', color: 'border-slate-200 text-slate-700 bg-slate-50' },
                { level: 'MEDIUM', label: 'Medium', color: 'border-blue-200 text-blue-700 bg-blue-50' },
                { level: 'HIGH', label: 'High', color: 'border-amber-200 text-amber-700 bg-amber-50' },
                { level: 'URGENT', label: 'Urgent', color: 'border-rose-200 text-rose-700 bg-rose-50' },
              ].map((p) => {
                const isSelected = priority === p.level;
                return (
                  <button
                    key={p.level}
                    type="button"
                    onClick={() => setPriority(p.level as any)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${
                      isSelected
                        ? `ring-2 ring-emerald-500 shadow-sm ${p.color} font-black`
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
              {initialTask ? 'Update Task' : 'Appoint Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffTaskModal;
