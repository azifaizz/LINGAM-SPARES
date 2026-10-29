import React, { useState } from 'react';

export const useConfirm = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [confirmText, setConfirmText] = useState('Confirm');
    const [cancelText, setCancelText] = useState('Cancel');
    const [variant, setVariant] = useState<'danger' | 'info'>('danger');
    const [callback, setCallback] = useState<(() => void) | null>(null);
    const [cancelCallback, setCancelCallback] = useState<(() => void) | null>(null);

    const confirm = (
        msg: string,
        onConfirm: () => void,
        titleStr: string = 'Confirm Action',
        onCancel?: () => void,
        options?: { confirmText?: string; cancelText?: string; variant?: 'danger' | 'info' }
    ) => {
        setMessage(msg);
        setTitle(titleStr);
        setCallback(() => onConfirm);
        setCancelCallback(() => onCancel || null);

        // Infer variant and text if not provided
        const isDelete = titleStr.toLowerCase().includes('delete') || msg.toLowerCase().includes('delete');
        setVariant(options?.variant || (isDelete ? 'danger' : 'info'));
        setConfirmText(options?.confirmText || (isDelete ? 'Yes, Delete' : 'Confirm'));
        setCancelText(options?.cancelText || 'Cancel');

        setIsOpen(true);
    };

    const close = () => {
        setIsOpen(false);
        setCallback(null);
        setCancelCallback(null);
    };

    const handleCancel = () => {
        if (cancelCallback) cancelCallback();
        close();
    };

    const handleConfirm = () => {
        if (callback) callback();
        close();
    };

    const ConfirmationDialog = () => {
        const hasOpen = isOpen; // Capture for effect dependency if needed, though closure handles it

        React.useEffect(() => {
            if (!hasOpen) return;

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [hasOpen]);

        return isOpen ? (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                <div
                    className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 opacity-100 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    {variant === 'danger' && (
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        </div>
                    )}

                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500 mb-6 text-sm leading-relaxed">{message}</p>

                    {/* Buttons */}
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-sm"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-2.5 text-white rounded-xl transition-colors font-semibold text-sm shadow-md ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        ) : null;
    };

    return { confirm, ConfirmationDialog };
};
