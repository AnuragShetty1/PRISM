"use client";

import { Fragment, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';

/**
 * A reusable, premium-styled confirmation modal.
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {function} props.onClose - Function to call when the modal is closed (Cancel).
 * @param {function} props.onConfirm - Function to call when the action is confirmed.
 * @param {string} props.title - The title of the modal.
 * @param {string} props.message - The confirmation message.
 * @param {string} [props.confirmText='Confirm'] - Text for the confirm button.
 * @param {string} [props.confirmColor='bg-blue-600'] - Tailwind color for the confirm button.
 * @param {boolean} [props.isLoading=false] - Shows a loading spinner on the confirm button.
 */
export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    confirmColor = 'bg-blue-600',
    isLoading = false
}) {
    const modalPanelRef = useRef(null);
    const cancelButtonRef = useRef(null);

    // Set focus to the cancel button when the modal opens
    useEffect(() => {
        if (isOpen && cancelButtonRef.current) {
            // A slight delay ensures the focus is set after the transition
            setTimeout(() => {
                cancelButtonRef.current.focus();
            }, 100);
        }
    }, [isOpen]);

    // Handle closing when clicking outside the modal panel
    const handleBackdropClick = (e) => {
        if (modalPanelRef.current && !modalPanelRef.current.contains(e.target)) {
            if (!isLoading) {
                onClose();
            }
        }
    };

    // --- NEW: Dynamic Icon Component ---
    const DynamicIcon = () => {
        if (confirmColor.includes('red')) {
            return <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />;
        }
        if (confirmColor.includes('green')) {
            return <CheckCircle className="h-6 w-6 text-green-600" aria-hidden="true" />;
        }
        // Default icon
        return <HelpCircle className="h-6 w-6 text-blue-600" aria-hidden="true" />;
    };

    // --- NEW: Dynamic Icon Background ---
    const getIconBgClass = () => {
        if (confirmColor.includes('red')) {
            return 'bg-red-100';
        }
        if (confirmColor.includes('green')) {
            return 'bg-green-100';
        }
        return 'bg-blue-100';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="relative z-50"
                    aria-labelledby="modal-title"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* --- REFACTORED: Backdrop with framer-motion --- */}
                    <motion.div
                        className="fixed inset-0 bg-gray-900/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={handleBackdropClick} // Use onClick for backdrop close
                    />

                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                            {/* --- REFACTORED: Modal Panel with framer-motion --- */}
                            <motion.div
                                ref={modalPanelRef}
                                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-6"
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                <div className="sm:flex sm:items-start">
                                    {/* --- REFACTORED: Dynamic Icon --- */}
                                    <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${getIconBgClass()} sm:mx-0 sm:h-10 sm:w-10`}>
                                        <DynamicIcon />
                                    </div>
                                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                                        {/* --- REFACTORED: Title --- */}
                                        <h3 className="text-lg font-bold leading-6 text-gray-900" id="modal-title">
                                            {title}
                                        </h3>
                                        {/* --- REFACTORED: Message --- */}
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-600">
                                                {message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {/* --- REFACTORED: Button Area --- */}
                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                    <button
                                        type="button"
                                        className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors
                                            ${confirmColor}
                                            ${isLoading
                                                ? 'opacity-70 cursor-not-allowed'
                                                : `hover:opacity-90`
                                            }
                                        `}
                                        onClick={onConfirm}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        ) : null}
                                        {isLoading ? 'Processing...' : confirmText}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0"
                                        onClick={onClose}
                                        ref={cancelButtonRef}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
