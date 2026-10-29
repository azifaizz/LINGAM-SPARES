import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, DollarSign, Package, FileText, Loader2 } from 'lucide-react';
import { Staff, StaffTarget, staffApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface StaffTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: Staff[];
  selectedStaffId?: string;
  initialTarget?: StaffTarget | null;
  onSuccess: () => void;
}

const StaffTargetModal: React.FC<StaffTargetModalProps> = ({
  isOpen,
  onClose,
  staffList,
  selectedStaffId,
  initialTarget,
  onSuccess,
}) => {
  const currentMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [staffId, setStaffId] = useState(selectedStaffId || (staffList[0]?.id || ''));
  const [period, setPeriod] = useState(currentMonthStr());
  const [targetAmount, setTargetAmount] = useState<number | string>(50000);
  const [targetQuantity, setTargetQuantity] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialTarget) {
      setStaffId(initialTarget.staffId);
      setPeriod(initialTarget.period || currentMonthStr());
      setTargetAmount(initialTarget.targetAmount || 0);
      setTargetQuantity(initialTarget.targetQuantity || 0);
      setNotes(initialTarget.notes || '');
    } else {
      setStaffId(selectedStaffId || (staffList[0]?.id || ''));
      setPeriod(currentMonthStr());
      setTargetAmount(50000);
      setTargetQuantity(0);
      setNotes('');
    }
  }, [initialTarget, selectedStaffId, staffList, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) {
      toast.error('Please select a staff member.');
      return;
    }
    const numAmount = Number(targetAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid sales target amount.');
      return;
    }

    const assignedStaff = staffList.find(s => s.id === staffId);
    setSaving(true);
    try {
      if (initialTarget && initialTarget.id) {
        await staffApi.updateTarget(initialTarget.id, {
          staffId,
          staffName: assignedStaff?.name || initialTarget.staffName || '',
          period,
          targetAmount: numAmount,
          targetQuantity: Number(targetQuantity) || 0,
          notes: notes.trim(),
        });
        toast.success('Sales target updated successfully!');
      } else {
        const payload: StaffTarget = {
          staffId,
          staffName: assignedStaff?.name || 'Staff',
          period,
          targetAmount: numAmount,
          targetQuantity: Number(targetQuantity) || 0,
          notes: notes.trim(),
          status: 'IN_PROGRESS',
        };
        await staffApi.createTarget(payload);
        toast.success('Sales target appointed successfully!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save staff target', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to save sales target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Target size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {initialTarget ? 'Edit Sales Target' : 'Appoint Sales Target'}
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Set performance goals achieved by selling products
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
          {/* Staff Member */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Assigned Staff Member <span className="text-red-500">*</span>
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full form-select border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              required
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role || 'Staff'}) — {s.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Period (Month) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-500" /> Target Month / Period <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {/* Target Amount (₹) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-500" /> Target Sales Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  step="500"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full pl-8 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  required
                />
              </div>
            </div>

            {/* Target Quantity (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Package size={14} className="text-purple-500" /> Target Product Units (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Incentive / Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-amber-500" /> Notes / Bonus Description
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Eligible for ₹2,000 festival bonus on achieving 100% target..."
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
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
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              {initialTarget ? 'Update Target' : 'Appoint Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffTargetModal;
