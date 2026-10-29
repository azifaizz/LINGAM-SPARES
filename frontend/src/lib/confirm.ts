export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
}

export const confirmAction = (options: ConfirmOptions | string, onConfirm?: () => void): Promise<boolean> => {
    const opts = typeof options === 'string'
        ? { message: options, variant: 'danger' as const }
        : { variant: 'danger' as const, ...options };

    const title = opts.title || 'Confirm Action';
    const message = opts.message;
    const confirmText = opts.confirmText || 'Yes, Clear Everything';
    const cancelText = opts.cancelText || 'Cancel';

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'confirm-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;animation:fadeIn 0.2s ease-out';

        const card = document.createElement('div');
        card.style.cssText = 'background:white;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);padding:32px;width:100%;max-width:420px;transform:scale(1);opacity:1;animation:zoomIn 0.2s ease-out;text-align:center;font-family:system-ui,-apple-system,sans-serif';

        card.innerHTML = `
            <div style="width:56px;height:56px;background:#FEE2E2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;flex-shrink:0">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <h3 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px">${title}</h3>
            <p style="color:#6B7280;margin:0 0 24px;font-size:14px;line-height:1.5">${message}</p>
            <div style="display:flex;gap:12px;width:100%">
                <button id="confirm-cancel-btn" style="flex:1;padding:10px 16px;color:#374151;background:#F3F4F6;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:14px;transition:background 0.15s">
                    ${cancelText}
                </button>
                <button id="confirm-ok-btn" style="flex:1;padding:10px 16px;color:white;background:#DC2626;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:14px;transition:background 0.15s;box-shadow:0 4px 6px -1px rgba(220,38,38,0.3)">
                    ${confirmText}
                </button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Add keyframe animations
        if (!document.getElementById('confirm-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'confirm-modal-styles';
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }

        const cleanup = () => {
            if (overlay.parentNode) {
                overlay.style.animation = 'fadeIn 0.15s ease-in reverse';
                setTimeout(() => overlay.remove(), 150);
            }
        };

        const cancelBtn = document.getElementById('confirm-cancel-btn')!;
        const okBtn = document.getElementById('confirm-ok-btn')!;

        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#E5E7EB'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#F3F4F6'; });
        okBtn.addEventListener('mouseenter', () => { okBtn.style.background = '#B91C1C'; });
        okBtn.addEventListener('mouseleave', () => { okBtn.style.background = '#DC2626'; });

        const handleConfirm = () => {
            cleanup();
            resolve(true);
            onConfirm?.();
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        cancelBtn.addEventListener('click', handleCancel);
        okBtn.addEventListener('click', handleConfirm);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) handleCancel();
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleKeyDown);
            } else if (e.key === 'Enter') {
                handleConfirm();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    });
};
