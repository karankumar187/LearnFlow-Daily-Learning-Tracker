import React, { useState } from 'react';
import { Bug, MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { feedbackAPI } from '../../services/api';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const Footer = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [feedbackType, setFeedbackType] = useState('feedback'); // 'bug' or 'feedback'
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useGSAP(() => {
        gsap.to("footer", {
            y: 0,
            opacity: 1,
            duration: 0.6,
            delay: 0.8,
            ease: "power2.out",
            clearProps: "all"
        });
    }, []);

    const openModal = (type) => {
        setFeedbackType(type);
        setMessage('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        try {
            setIsSubmitting(true);
            await feedbackAPI.submit({
                type: feedbackType,
                message: message.trim()
            });

            toast.success(`${feedbackType === 'bug' ? 'Bug report' : 'Feedback'} submitted successfully. Thank you!`);
            closeModal();
        } catch (error) {
            toast.error(
                error.response?.data?.errors?.[0]?.msg ||
                error.response?.data?.message ||
                error.message ||
                'Failed to submit. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <footer className="mt-auto py-6 px-4 lg:px-8 border-t border-gray-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm opacity-0 translate-y-5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                        Website is currently in active development phase
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => openModal('bug')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                            <Bug className="w-4 h-4" />
                            Report Bug
                        </button>
                        <button
                            onClick={() => openModal('feedback')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Feedback
                        </button>
                    </div>
                </div>
            </footer>

            {/* Unified Feedback / Bug Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden glass-card transform transition-all">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${feedbackType === 'bug' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                                        {feedbackType === 'bug' ? <Bug className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                                            {feedbackType === 'bug' ? 'Report a Bug' : 'Share Feedback'}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {feedbackType === 'bug' ? 'Help us squash errors to improve LearnFlow.' : 'Tell us what you love or what we can do better.'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder={feedbackType === 'bug' ? "Describe the bug, what you were doing, and what went wrong..." : "Share your ideas, feature requests, or general thoughts..."}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors outline-none min-h-[120px] resize-none"
                                        maxLength={1000}
                                        required
                                    />
                                    <div className="text-right mt-1 text-xs text-gray-400">
                                        {message.length} / 1000
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 font-medium">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!message.trim() || isSubmitting}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white transition-all ${feedbackType === 'bug'
                                            ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                                            : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        Submit {feedbackType === 'bug' ? 'Report' : 'Feedback'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Footer;
