import { createContext, useContext, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext()

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

/**
 * ToastProvider - Provides toast notification system to the app
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = ({ message, type = 'info', duration = 3000 }) => {
        const id = Math.random().toString(36).substr(2, 9)
        setToasts(prev => [...prev, { id, message, type }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }

    const toast = {
        success: (message, duration) => addToast({ message, type: 'success', duration }),
        error: (message, duration) => addToast({ message, type: 'error', duration }),
        warning: (message, duration) => addToast({ message, type: 'warning', duration }),
        info: (message, duration) => addToast({ message, type: 'info', duration })
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map(toast => (
                <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
            ))}
        </div>
    )
}

function Toast({ id, message, type, onClose }) {
    const styles = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-800',
            icon: CheckCircle,
            iconColor: 'text-green-600'
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-800',
            icon: XCircle,
            iconColor: 'text-red-600'
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-800',
            icon: AlertCircle,
            iconColor: 'text-amber-600'
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-800',
            icon: Info,
            iconColor: 'text-blue-600'
        }
    }

    const style = styles[type]
    const Icon = style.icon

    return (
        <div
            className={`${style.bg} ${style.border} ${style.text} px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 min-w-[300px] animate-in slide-in-from-right duration-300`}
        >
            <Icon className={`${style.iconColor} flex-shrink-0`} size={20} />
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button
                onClick={onClose}
                className={`${style.iconColor} hover:opacity-70 transition-opacity flex-shrink-0`}
                aria-label="Fechar notificação"
            >
                <X size={16} />
            </button>
        </div>
    )
}
