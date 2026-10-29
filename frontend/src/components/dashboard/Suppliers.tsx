import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Pencil, Trash2, PlusCircle, X, Upload, CreditCard, Loader2, Save,
  Truck, Search, Building2, Phone, MapPin, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { vendorService, Vendor } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import Papa from 'papaparse';
import { parseExcelFile } from '@/utils/excelParser';
import SupplierCreditPanel from './SupplierCreditPanel';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/context/AuthContext';

const Suppliers = () => {
  const { user } = useAuth();
  const isCashier = user?.role?.toLowerCase() === 'cashier';
  const { vendors: suppliers, loading: globalLoading, refreshVendors: refreshSuppliers, mutateVendors, isSyncing } = useGlobalData();
  const { confirm: confirmAction, ConfirmationDialog } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Vendor | null>(null);
  const [isCreditPanelOpen, setIsCreditPanelOpen] = useState(false);
  const [selectedSupplierForCredit, setSelectedSupplierForCredit] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false); // For CSV/local actions
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; contact: string; gst: string; address: string; state: string; customId: string; vendorInvoice: string }>({
    name: '', contact: '', gst: '', address: '', state: '', customId: '', vendorInvoice: ''
  });

  const handleEditClick = (s: Vendor) => {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      contact: s.phone || '',
      gst: s.gstin || '',
      address: s.address || '',
      state: s.state || '',
      customId: s.id || '',
      vendorInvoice: s.vendorInvoice || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', contact: '', gst: '', address: '', state: '', customId: '', vendorInvoice: '' });
  };

  const handleSaveSupplier = async (supplier: Omit<Vendor, 'id'> & { id?: string; newId?: string; contact?: string; gst?: string; }) => {
    if (!supplier.id) {
      const isDuplicate = suppliers.some(
        s => s.name.trim().toLowerCase() === supplier.name.trim().toLowerCase()
      );
      if (isDuplicate) {
        toast.error(`Supplier "${supplier.name}" already exists.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        id: supplier.newId || supplier.id,
        name: supplier.name,
        phone: supplier.contact,
        address: supplier.address,
        state: supplier.state,
        gstNo: supplier.gst,
        vendorInvoice: supplier.vendorInvoice,
      };

      if (supplier.id) {
        await vendorService.patch(`/vendors/update/${supplier.id}`, payload);
        toast.success('Supplier updated!');
      } else {
        await vendorService.post('/vendors/add', payload);
        toast.success('Supplier added!');
      }
      await refreshSuppliers();
      handleCloseModal();
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInline = () => {
    if (!editingId) return;
    handleSaveSupplier({ ...editForm, id: editingId, newId: editForm.customId } as any);
  };

  const handleDeleteSupplier = (id: string) => {
    confirmAction("Are you sure you want to delete this supplier?", async () => {
      setDeletingId(id);
      try {
        await vendorService.delete(`/vendors/delete/${id}`);
        mutateVendors(prev => prev.filter(v => v.id !== id));
        toast.success('Deleted!');
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Delete failed.');
      } finally {
        setDeletingId(null);
      }
    }, "Delete Supplier");
  };

  // CSV Upload
  const handleUploadClick = () => fileInputRef.current?.click();

  const processRows = async (rows: any[]) => {
    if (rows.length === 0) {
      toast.error('File is empty.');
      setLoading(false);
      return;
    }

    let success = 0, failed = 0;

    for (const row of rows) {
      const payload = {
        name: row.name?.trim() || row.Name?.trim() || row['Supplier Name']?.trim(),
        phone: (row.contact || row.phone || row.Phone || row.Contact || '').toString().trim(),
        address: (row.address || row.Address || '').trim(),
        state: (row.state || row.State || '').trim(),
        gstNo: (row.gst || row.gstin || row.GST || row.GSTIN || '').trim(),
      };

      if (!payload.name) {
        failed++;
        continue;
      }

      try {
        await vendorService.post('/vendors/add', payload);
        success++;
      } catch (err) {
        failed++;
      }
    }

    toast.success(`Import complete: ${success} added, ${failed} failed.`);
    await refreshSuppliers();
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data as any[]),
        error: (err) => {
          toast.error('CSV Parse error: ' + err.message);
          setLoading(false);
        }
      });
    } else if (file.name.match(/\.(xlsx|xls)$/)) {
      try {
        const data = await parseExcelFile(file);
        processRows(data);
      } catch (err: any) {
        toast.error('Excel Parse error: ' + err.message);
        setLoading(false);
      }
    } else {
      toast.error("Unsupported file type");
      setLoading(false);
    }
  };

  const handleOpenModal = (s: Vendor | null) => {
    setEditingSupplier(s);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleOpenCredit = (s: Vendor) => {
    setSelectedSupplierForCredit(s);
    setIsCreditPanelOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s =>
    (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.id && s.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.phone && s.phone.includes(searchTerm)) ||
    (s.gstin && s.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.state && s.state.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Quick Metrics
  const totalCount = suppliers.length;
  const gstCount = suppliers.filter(s => s.gstin && s.gstin.trim().length > 3).length;
  const stateCount = new Set(suppliers.map(s => s.state).filter(Boolean)).size;

  return (
    <div className="space-y-6 p-4 sm:p-8 bg-gradient-to-br from-indigo-50/50 via-blue-50/30 to-slate-100 min-h-screen">
      <ConfirmationDialog />
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />

      {/* 1. HEADER AREA */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-sm border border-white/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/25">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Suppliers Directory</h1>
              <SyncIndicator isSyncing={isSyncing} className="scale-90" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              Manage vendors, purchase contacts, GST details, and credit records
            </p>
          </div>
        </div>

        {!isCashier && (
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleUploadClick}
              disabled={loading}
              className="h-11 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm flex-1 sm:flex-none"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>Import Excel</span>
            </button>
            <button
              onClick={() => handleOpenModal(null)}
              className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 flex-1 sm:flex-none"
            >
              <PlusCircle size={17} />
              <span>Add Supplier</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. STAT KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Suppliers</span>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GST Registered</span>
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight mt-0.5">{gstCount}</div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <MapPin size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">States Covered</span>
            <div className="text-2xl font-black text-purple-700 font-mono tracking-tight mt-0.5">{stateCount || 1}</div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER BAR */}
      <div className="bg-white/95 rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by supplier name, phone, GST, or state..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50/70 border border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs sm:text-sm font-medium transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          Showing <span className="font-bold text-slate-800">{filteredSuppliers.length}</span> of {totalCount} suppliers
        </div>
      </div>

      {/* 4. SUPPLIERS TABLE */}
      <div className="bg-white/95 rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden backdrop-blur-sm">
        {globalLoading && suppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium">Loading suppliers directory...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-14 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Truck size={28} />
            </div>
            <p className="text-base font-bold text-slate-700">No suppliers found</p>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchTerm ? 'Try adjusting your search criteria or clear the search filter' : 'Get started by adding your first supplier using the button above'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="p-3.5 text-center w-14">S.No</th>
                  <th className="p-3.5 min-w-[200px]">Supplier Name</th>
                  <th className="p-3.5 w-32">Supplier ID</th>
                  <th className="p-3.5 w-36">Contact No</th>
                  <th className="p-3.5 w-44">GST Number</th>
                  <th className="p-3.5 min-w-[180px]">Address</th>
                  <th className="p-3.5 w-28">State</th>
                  {!isCashier && <th className="p-3.5 text-center w-28">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s, i) => {
                  const isEditing = editingId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="p-3.5 text-center text-slate-400 font-semibold text-xs">{i + 1}</td>

                      {isEditing ? (
                        <>
                          <td className="p-3.5">
                            <input
                              id={`edit-name-${s.id}`}
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-contact-${s.id}`)?.focus(); } }}
                              className="border border-blue-300 focus:ring-2 focus:ring-blue-400 rounded-lg p-1.5 w-full text-xs font-semibold"
                              autoFocus
                            />
                          </td>
                          <td className="p-3.5">
                            <input value={editForm.customId} disabled className="border rounded-lg p-1.5 w-full font-mono text-xs bg-slate-100 text-slate-400 cursor-not-allowed" placeholder="ID" />
                          </td>
                          <td className="p-3.5">
                            <input
                              id={`edit-contact-${s.id}`}
                              value={editForm.contact}
                              onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-gst-${s.id}`)?.focus(); } }}
                              className="border border-blue-300 focus:ring-2 focus:ring-blue-400 rounded-lg p-1.5 w-full text-xs"
                            />
                          </td>
                          <td className="p-3.5">
                            <input
                              id={`edit-gst-${s.id}`}
                              value={editForm.gst}
                              onChange={e => setEditForm({ ...editForm, gst: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-address-${s.id}`)?.focus(); } }}
                              className="border border-blue-300 focus:ring-2 focus:ring-blue-400 rounded-lg p-1.5 w-full text-xs uppercase"
                            />
                          </td>
                          <td className="p-3.5">
                            <input
                              id={`edit-address-${s.id}`}
                              value={editForm.address}
                              onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-state-${s.id}`)?.focus(); } }}
                              className="border border-blue-300 focus:ring-2 focus:ring-blue-400 rounded-lg p-1.5 w-full text-xs"
                            />
                          </td>
                          <td className="p-3.5">
                            <input
                              id={`edit-state-${s.id}`}
                              value={editForm.state}
                              onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveInline(); } }}
                              className="border border-blue-300 focus:ring-2 focus:ring-blue-400 rounded-lg p-1.5 w-full text-xs"
                            />
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={handleSaveInline}
                                disabled={isSaving}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save Changes"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3.5 font-bold text-slate-800">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100 uppercase shrink-0">
                                {s.name ? s.name.charAt(0) : 'S'}
                              </div>
                              <span className="truncate">{s.name}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {s.id || '-'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 font-mono">
                              <Phone size={12} className="text-slate-400" />
                              <span>{s.phone || '-'}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            {s.gstin ? (
                              <span className="font-mono text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                                {s.gstin}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unregistered</span>
                            )}
                          </td>
                          <td className="p-3.5 text-xs text-slate-600 max-w-xs truncate" title={s.address}>
                            {s.address || '-'}
                          </td>
                          <td className="p-3.5">
                            {s.state ? (
                              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                                {s.state}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          {!isCashier && (
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditClick(s)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Supplier"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleOpenCredit(s)}
                                  className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Manage Credit History"
                                >
                                  <CreditCard size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSupplier(s.id)}
                                  disabled={deletingId === s.id}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Delete Supplier"
                                >
                                  {deletingId === s.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <SupplierFormModal supplier={editingSupplier} onSave={handleSaveSupplier} onClose={handleCloseModal} isSaving={isSaving} />
      )}

      {isCreditPanelOpen && selectedSupplierForCredit && (
        <SupplierCreditPanel
          supplierId={selectedSupplierForCredit.id}
          supplierName={selectedSupplierForCredit.name}
          onClose={() => setIsCreditPanelOpen(false)}
        />
      )}
    </div>
  );
};

const SupplierFormModal = ({ supplier, onSave, onClose, isSaving }: { supplier: Vendor | null; onSave: any; onClose: () => void; isSaving?: boolean }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact: supplier?.phone || '',
    gst: supplier?.gstin || '',
    vendorInvoice: supplier?.vendorInvoice || '',
    address: supplier?.address || '',
    state: supplier?.state || '',
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const gstRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({ ...form, id: supplier?.id });
  };

  const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-lg border border-slate-100 animate-in fade-in duration-200">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Truck size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{supplier ? 'Edit' : 'Add New'} Supplier</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Supplier Name *</label>
            <input
              ref={nameRef}
              required
              placeholder="e.g. Bosch Automotive Ltd"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => handleEnter(e, contactRef)}
              className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Contact Phone</label>
              <input
                ref={contactRef}
                type="text"
                placeholder="10-digit number"
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                onKeyDown={(e) => handleEnter(e, gstRef)}
                className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">GSTIN Number</label>
              <input
                ref={gstRef}
                placeholder="15-digit GSTIN"
                value={form.gst}
                onChange={e => setForm({ ...form, gst: e.target.value })}
                onKeyDown={(e) => handleEnter(e, addressRef)}
                className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Billing / Office Address</label>
            <input
              ref={addressRef}
              placeholder="Door / Street / City"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              onKeyDown={(e) => handleEnter(e, stateRef)}
              className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">State</label>
            <input
              ref={stateRef}
              placeholder="e.g. Tamil Nadu"
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 px-6 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isSaving ? 'Saving...' : 'Save Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Suppliers;
