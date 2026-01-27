import { X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Modal Component - Base modal for all dialogs
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal should close
 * @param {string} title - Modal title
 * @param {React.ReactNode} children - Modal content
 * @param {React.ReactNode} footer - Optional footer content (buttons)
 * @param {string} variant - 'default' | 'destructive' | 'warning'
 */
export function Modal({ isOpen, onClose, title, children, footer, variant = 'default' }) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const variantStyles = {
        default: 'border-slate-200',
        destructive: 'border-red-200',
        warning: 'border-amber-200'
    }

    const headerStyles = {
        default: 'text-slate-900',
        destructive: 'text-red-700',
        warning: 'text-amber-700'
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div
                className={`bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 ${variantStyles[variant]} animate-in fade-in zoom-in duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h3 className={`text-xl font-semibold ${headerStyles[variant]}`}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                        aria-label="Fechar modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex gap-3 p-6 pt-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * ConfirmModal - Pre-configured modal for confirmation dialogs
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 * @param {function} onConfirm - Callback when user confirms
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Text for confirm button (default: "Confirmar")
 * @param {string} cancelText - Text for cancel button (default: "Cancelar")
 * @param {boolean} isDestructive - If true, uses red/destructive styling
 * @param {boolean} isLoading - If true, shows loading state on confirm button
 */
export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false,
    isLoading = false
}) {
    const handleConfirm = () => {
        onConfirm()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            variant={isDestructive ? 'destructive' : 'default'}
            footer={
                <>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50 ${isDestructive
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-navita-blue text-white hover:bg-navita-dark-blue'
                            }`}
                    >
                        {isLoading ? 'Processando...' : confirmText}
                    </button>
                </>
            }
        >
            <p className="text-slate-600 leading-relaxed">
                {message}
            </p>
        </Modal>
    )
}
