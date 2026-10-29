import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ConfirmPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (paymentMethod: string) => void;
    title?: string;
    message: string;
}

const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({ isOpen, onClose, onConfirm, title = "Confirm Action", message }) => {
    const [paymentMethod, setPaymentMethod] = useState('Cash');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-sm transform transition-all scale-100 opacity-100 animate-in zoom-in-95 duration-200 flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-800 font-bold text-center mb-6">{message}</p>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            Payment Method <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full form-select rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 font-medium text-gray-700 h-11 px-3 appearance-none"
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(paymentMethod)}
                        className="flex-1 px-4 py-2.5 text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm shadow-sm"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmPaymentModal;
