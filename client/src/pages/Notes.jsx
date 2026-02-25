import React, { useState, useEffect, useRef } from 'react';
import {
    FileText,
    Plus,
    Trash2,
    Calendar,
    Save,
    Clock,
    ChevronRight,
    Menu,
    X,
    Search,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { notesAPI } from '../services/api';
gsap.registerPlugin(useGSAP);

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [activeNote, setActiveNote] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');

    const notesListRef = useRef(null);
    const editorRef = useRef(null);

    // Fetch notes on load
    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            setIsLoading(true);
            const res = await notesAPI.getAll();
            setNotes(res.data.data);

            // Select first note automatically if none selected
            if (res.data.data.length > 0 && !activeNote) {
                setActiveNote(res.data.data[0]);
            }
        } catch (error) {
            toast.error('Failed to load notes');
        } finally {
            setIsLoading(false);
        }
    };

    // GSAP Animation for list stagger
    useGSAP(() => {
        if (!isLoading && notes.length > 0 && notesListRef.current) {
            gsap.fromTo(
                notesListRef.current.children,
                { opacity: 0, x: -20 },
                {
                    opacity: 1,
                    x: 0,
                    stagger: 0.05,
                    duration: 0.4,
                    ease: "power2.out",
                    clearProps: "all"
                }
            );
        }
    }, { dependencies: [isLoading, notes.length], scope: notesListRef });

    // Handle creating a new note
    const handleCreateNoteClick = () => {
        setNewNoteTitle('');
        setIsCreateModalOpen(true);
    };

    const handleCreateNoteSubmit = async () => {
        if (!newNoteTitle.trim()) {
            toast.error('Please enter a note title');
            return;
        }

        try {
            const res = await notesAPI.create({
                title: newNoteTitle.trim(),
                content: ''
            });

            const newNote = res.data.data;
            setNotes([newNote, ...notes]);
            setActiveNote(newNote);
            setIsMobileMenuOpen(false);
            setIsCreateModalOpen(false);

            gsap.fromTo(editorRef.current,
                { scale: 0.98, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.3 }
            );

        } catch (error) {
            toast.error('Failed to create new note');
        }
    };

    // Handle saving the current active note
    const handleSaveNote = async (isAutoSave = false) => {
        if (!activeNote) return;

        try {
            if (!isAutoSave) setIsSaving(true);
            const res = await notesAPI.update(activeNote._id, {
                title: activeNote.title,
                content: activeNote.content
            });

            // Update local state list
            setNotes(prevNotes => {
                const updatedNotes = prevNotes.map(n =>
                    n._id === activeNote._id ? res.data.data : n
                );
                // Sort to put most recently updated at the top
                updatedNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                return updatedNotes;
            });

            if (isAutoSave) {
                // For auto-save, only update the timestamp so we don't interrupt typing
                setActiveNote(prev => prev?._id === activeNote._id ? { ...prev, updatedAt: res.data.data.updatedAt } : prev);
            } else {
                setActiveNote(res.data.data);
                toast.success('Note saved successfully');
            }
        } catch (error) {
            if (!isAutoSave) toast.error('Failed to save note');
        } finally {
            if (!isAutoSave) setIsSaving(false);
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (!activeNote) return;

        const timer = setTimeout(() => {
            setNotes(currentNotes => {
                const originalNote = currentNotes.find(n => n._id === activeNote._id);
                // If the note has changed compared to the canoncial list, auto-save silently
                if (originalNote && (originalNote.title !== activeNote.title || originalNote.content !== activeNote.content)) {
                    handleSaveNote(true);
                }
                return currentNotes;
            });
        }, 1500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeNote?.title, activeNote?.content]);

    // Debounced auto-save listener (Optional: just visual for now without triggering tons of API calls)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // CMD+S or CTRL+S
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSaveNote(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeNote]);

    // Handle deleting a note
    const handleDeleteNote = async (noteId, e) => {
        e.stopPropagation(); // prevent selecting the note

        if (!window.confirm('Are you sure you want to delete this note?')) return;

        try {
            // Find the DOM element for animation
            const noteElement = document.getElementById(`note-${noteId}`);
            if (noteElement) {
                gsap.to(noteElement, {
                    scale: 0.9,
                    opacity: 0,
                    height: 0,
                    marginBottom: 0,
                    duration: 0.3,
                    onComplete: async () => {
                        await notesAPI.delete(noteId);
                        const filtered = notes.filter(n => n._id !== noteId);
                        setNotes(filtered);

                        if (activeNote?._id === noteId) {
                            setActiveNote(filtered.length > 0 ? filtered[0] : null);
                        }
                        toast.success('Note deleted');
                    }
                });
            } else {
                await notesAPI.delete(noteId);
                const filtered = notes.filter(n => n._id !== noteId);
                setNotes(filtered);
                if (activeNote?._id === noteId) {
                    setActiveNote(filtered.length > 0 ? filtered[0] : null);
                }
            }
        } catch (error) {
            toast.error('Failed to delete note');
        }
    };

    const filteredNotes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Note</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <input
                            autoFocus
                            type="text"
                            placeholder="e.g. System Design Interview..."
                            value={newNoteTitle}
                            onChange={(e) => setNewNoteTitle(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-green-700 mb-6 text-gray-800 dark:text-white transition-all"
                            onKeyDown={(e) => { if (e.key === 'Enter' && newNoteTitle.trim()) handleCreateNoteSubmit(); }}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-gray-500 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateNoteSubmit}
                                disabled={!newNoteTitle.trim()}
                                className="px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white font-medium transition-colors  dark:shadow-none disabled:opacity-50"
                            >
                                Create Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="h-[calc(100vh-12rem)] min-h-[600px] flex flex-col md:flex-row gap-6">

                {/* Mobile Menu Toggle */}
                <div className="md:hidden flex justify-between items-center mb-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-green-700" />
                        Notes
                    </h1>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm"
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* LEFT PANE: Notes List */}
                <div className={`
        ${isMobileMenuOpen ? 'flex' : 'hidden'} 
        md:flex flex-col w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 
        rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 
        overflow-hidden flex-shrink-0 z-10 transition-all h-full
      `}>
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800">
                        <button
                            onClick={handleCreateNoteClick}
                            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white py-2.5 px-4 rounded-xl transition-colors font-medium mb-4 shadow-sm shadow-green-100 dark:shadow-none"
                        >
                            <Plus className="w-5 h-5" />
                            New Note
                        </button>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-700/50 outline-none transition-all dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3" ref={notesListRef}>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin mb-2 text-green-700" />
                                <p className="text-sm">Loading notes...</p>
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="text-center p-6 text-gray-400">
                                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No notes found.</p>
                                {searchQuery && <p className="text-xs mt-1">Try a different search term.</p>}
                            </div>
                        ) : (
                            filteredNotes.map((note) => (
                                <div
                                    key={note._id}
                                    id={`note-${note._id}`}
                                    onClick={() => {
                                        setActiveNote(note);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`
                  group relative p-3 mb-1.5 rounded-xl cursor-pointer transition-all duration-200 border
                  ${activeNote?._id === note._id
                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50 shadow-sm'
                                            : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}
                `}
                                >
                                    <div className="pr-6 mb-0.5">
                                        <h3 className={`font-medium text-sm truncate ${activeNote?._id === note._id ? 'text-green-900 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                                            {note.title || 'Untitled'}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={(e) => handleDeleteNote(note._id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all absolute right-2 top-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1 pr-4">
                                        {note.content || 'No content...'}
                                    </p>

                                    <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 gap-3">
                                        <span className="flex items-center gap-1 uppercase tracking-wider font-semibold">
                                            {format(new Date(note.updatedAt || new Date()), 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT PANE: Editor */}
                <div
                    ref={editorRef}
                    className={`
          flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border 
          border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden h-full
          ${!activeNote && !isMobileMenuOpen ? 'hidden md:flex' : 'flex'}
        `}
                >
                    {activeNote ? (
                        <>
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-900/50">
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        value={activeNote.title}
                                        onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                                        className="w-full text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
                                        placeholder="Note Title"
                                    />
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Created: {format(new Date(activeNote.createdAt || new Date()), 'MMM d, yyyy')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            Last edited {format(new Date(activeNote.updatedAt || new Date()), 'h:mm a')}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSaving}
                                    className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white px-4 py-2 rounded-xl transition-colors font-medium disabled:opacity-70"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save Note
                                </button>
                            </div>

                            <textarea
                                value={activeNote.content}
                                onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
                                placeholder="Start typing your note here..."
                                className="flex-1 w-full p-6 bg-transparent border-none outline-none resize-none text-gray-700 dark:text-gray-300 leading-relaxed text-lg focus:ring-0 custom-scrollbar"
                            />
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center h-full">
                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <FileText className="w-10 h-10 text-gray-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Note Selected</h3>
                            <p className="max-w-sm mb-6">Choose a note from the list on the left, or create a new one to get started saving your thoughts.</p>
                            <button
                                onClick={handleCreateNoteClick}
                                className="flex items-center gap-2 text-green-800 dark:text-green-400 font-medium hover:underline"
                            >
                                <Plus className="w-5 h-5" />
                                Create a new note
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
};

export default Notes;
