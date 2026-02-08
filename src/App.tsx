import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Check, X, Moon, Sun, Filter } from 'lucide-react';

// ==================== UTILS ====================
/**
 * Check if code is running on client-side
 */
const isClient = typeof window !== 'undefined';

// ==================== MODEL ====================
/**
 * Note Model - Represents a single note entity
 */
class Note {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;

  constructor(
    id: string,
    title: string,
    description: string,
    completed: boolean = false,
    createdAt: Date = new Date()
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.completed = completed;
    this.createdAt = createdAt;
  }

  /**
   * Toggle the completion status of the note
   */
  toggleCompletion(): Note {
    return new Note(
      this.id,
      this.title,
      this.description,
      !this.completed,
      this.createdAt
    );
  }

  /**
   * Update note data
   */
  update(title: string, description: string): Note {
    return new Note(this.id, title, description, this.completed, this.createdAt);
  }

  /**
   * Serialize note to JSON-compatible object
   */
  toJSON(): NoteData {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      completed: this.completed,
      createdAt: this.createdAt
    };
  }

  /**
   * Deserialize note from JSON data
   */
  static fromJSON(data: NoteData): Note {
    return new Note(
      data.id,
      data.title,
      data.description,
      data.completed,
      new Date(data.createdAt)
    );
  }
}

// ==================== TYPES ====================
interface NoteData {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date | string;
}

type FilterStatus = 'all' | 'pending' | 'completed';

interface FormData {
  title: string;
  description: string;
}

// ==================== SERVICE ====================
/**
 * StorageService - Handles all sessionStorage operations with SSR support
 */
class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'darkMode',
    NOTES: 'notes',
  });

  /**
   * Save data to sessionStorage (client-side only)
   */
  static saveToStorage(key: string, value: any): void {
    if (!isClient) return;

    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  }

  /**
   * Load data from sessionStorage with default fallback (client-side only)
   */
  static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!isClient) return defaultValue;

    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return defaultValue;
    }
  }

  /**
   * Clear all app data from storage (client-side only)
   */
  static clearStorage(): void {
    if (!isClient) return;

    try {
      sessionStorage.removeItem(this.STORAGE_KEYS.DARK_MODE);
      sessionStorage.removeItem(this.STORAGE_KEYS.NOTES);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Get storage keys
   */
  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ==================== CONTROLLER ====================
/**
 * NotesController - Handles business logic and data management
 */
class NotesController {
  /**
   * Generate unique ID for new notes
   */
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Load dark mode from storage using StorageService
   */
  static loadDarkMode(): boolean {
    return StorageService.loadFromStorage<boolean>(
      StorageService.getKeys().DARK_MODE,
      false
    );
  }

  /**
   * Save dark mode to storage using StorageService
   */
  static saveDarkMode(isDarkMode: boolean): void {
    StorageService.saveToStorage(
      StorageService.getKeys().DARK_MODE,
      isDarkMode
    );
  }

  /**
   * Load notes from storage using StorageService
   */
  static loadNotes(): Note[] {
    const defaultNotes = [
      new Note(
        '1',
        'Bem-vindo!',
        'Este é seu sistema de anotações. Clique em "Nova Nota" para começar.',
        false,
        new Date('2025-11-01')
      ),
    ];

    const notesData = StorageService.loadFromStorage<NoteData[]>(
      StorageService.getKeys().NOTES,
      []
    );

    if (notesData.length === 0) {
      return defaultNotes;
    }

    return notesData.map(data => Note.fromJSON(data));
  }

  /**
   * Save notes to storage using StorageService
   */
  static saveNotes(notes: Note[]): void {
    const serialized = notes.map(note => note.toJSON());
    StorageService.saveToStorage(
      StorageService.getKeys().NOTES,
      serialized
    );
  }

  /**
   * Filter notes based on search term and filter status
   */
  static filterNotes(
    notes: Note[],
    searchTerm: string,
    filterStatus: FilterStatus
  ): Note[] {
    return notes.filter(note => {
      const matchesSearch =
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'completed' && note.completed) ||
        (filterStatus === 'pending' && !note.completed);

      return matchesSearch && matchesFilter;
    });
  }

  /**
   * Create a new note
   */
  static createNote(title: string, description: string): Note {
    return new Note(this.generateId(), title, description);
  }

  /**
   * Clear all data using StorageService
   */
  static clearAllData(): void {
    StorageService.clearStorage();
  }
}

// ==================== VIEW ====================
/**
 * NotesApp Component - Main view with SSR support
 */
export default function NotesApp() {
  // State management with SSR-safe initialization
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState<FormData>({ title: '', description: '' });
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydration effect - load data only on client-side
  React.useEffect(() => {
    setIsDarkMode(NotesController.loadDarkMode());
    setNotes(NotesController.loadNotes());
    setIsHydrated(true);
  }, []);

  // Sync dark mode to sessionStorage (client-side only)
  React.useEffect(() => {
    if (!isHydrated) return;
    NotesController.saveDarkMode(isDarkMode);
  }, [isDarkMode, isHydrated]);

  // Sync notes to sessionStorage (client-side only)
  React.useEffect(() => {
    if (!isHydrated) return;
    NotesController.saveNotes(notes);
  }, [notes, isHydrated]);

  // Filtered notes - memoized for performance
  const filteredNotes = useMemo(
    () => NotesController.filterNotes(notes, searchTerm, filterStatus),
    [notes, searchTerm, filterStatus]
  );

  // Event handlers
  const handleSaveNote = (): void => {
    if (!formData.title.trim()) return;

    if (editingNote) {
      // Update existing note
      setNotes(notes.map(note =>
        note.id === editingNote.id
          ? note.update(formData.title, formData.description)
          : note
      ));
    } else {
      // Create new note
      const newNote = NotesController.createNote(formData.title, formData.description);
      setNotes([newNote, ...notes]);
    }

    closeModal();
  };

  const handleDeleteNote = (id: string): void => {
    setNotes(notes.filter(note => note.id !== id));
  };

  const toggleNoteCompletion = (id: string): void => {
    setNotes(notes.map(note =>
      note.id === id ? note.toggleCompletion() : note
    ));
  };

  const openCreateModal = (): void => {
    setEditingNote(null);
    setFormData({ title: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (note: Note): void => {
    setEditingNote(note);
    setFormData({ title: note.title, description: note.description });
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    setEditingNote(null);
    setFormData({ title: '', description: '' });
  };

  const handleClearData = (): void => {
    if (!isClient) return;

    if (window.confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
      NotesController.clearAllData();
      setNotes([]);
      setSearchTerm('');
      setFilterStatus('all');
    }
  };

  return (
    <>
      <style>{APP_STYLES}</style>

      <div className={`notes-app ${isDarkMode ? 'dark' : ''}`}>
        {/* Header */}
        <header className="header">
          <div className="header-container">
            <div className="header-logo">
              <div className="logo-icon">
                <Check size={24} color="#ffffff" />
              </div>
              <h1 className="logo-text">Minhas Anotações</h1>
            </div>
            <div className="header-actions">
              <button onClick={handleClearData} className="btn btn-clear">
                Limpar Dados
              </button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="btn btn-theme">
                {isDarkMode ? <Sun size={20} color="#fbbf24" /> : <Moon size={20} color="#4f46e5" />}
              </button>
              <button onClick={openCreateModal} className="btn btn-primary">
                <Plus size={20} />
                <span>Nova Nota</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          {/* Search and Filter Bar */}
          <div className="search-filter-bar">
            <div className="search-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Pesquisar anotações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-buttons">
              <button
                onClick={() => setFilterStatus('all')}
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`filter-btn ${filterStatus === 'completed' ? 'active' : ''}`}
              >
                Concluídas
              </button>
            </div>
          </div>

          {/* Notes Grid */}
          {filteredNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Filter size={40} color="#9ca3af" />
              </div>
              <p className="empty-text">
                {notes.length === 0 ? 'Nenhuma anotação criada ainda' : 'Nenhuma anotação encontrada'}
              </p>
            </div>
          ) : (
            <div className="notes-grid">
              {filteredNotes.map(note => (
                <div key={note.id} className={`note-card ${note.completed ? 'completed' : ''}`}>
                  <button
                    onClick={() => toggleNoteCompletion(note.id)}
                    className={`note-checkbox ${note.completed ? 'checked' : ''}`}
                  >
                    {note.completed && <Check size={16} color="#ffffff" />}
                  </button>
                  <h3 className={`note-title ${note.completed ? 'completed' : ''}`}>
                    {note.title}
                  </h3>
                  <p className={`note-description ${note.completed ? 'completed' : ''}`}>
                    {note.description || 'Sem descrição'}
                  </p>
                  <div className="note-actions">
                    <button onClick={() => openEditModal(note)} className="action-btn action-btn-edit">
                      <Edit2 size={16} />
                      Editar
                    </button>
                    <button onClick={() => handleDeleteNote(note.id)} className="action-btn action-btn-delete">
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Modal */}
        {isModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">
                  {editingNote ? 'Editar Anotação' : 'Nova Anotação'}
                </h2>
                <button onClick={closeModal} className="modal-close">
                  <X size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                </button>
              </div>
              <div className="modal-form">
                <div className="form-group">
                  <label className="form-label">Título *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Digite o título da anotação"
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Digite a descrição (opcional)"
                    rows={4}
                    className="form-input form-textarea"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button onClick={closeModal} className="btn-cancel">
                  Cancelar
                </button>
                <button onClick={handleSaveNote} disabled={!formData.title.trim()} className="btn-save">
                  {editingNote ? 'Salvar Alterações' : 'Criar Anotação'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const APP_STYLES = `
  /* Global Styles */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  .notes-app {
    min-height: 100vh;
    background-color: #f0f4ff;
    transition: all 0.3s ease;
  }
  .notes-app.dark {
    background-color: #111827;
  }
  /* Header Styles */
  .header {
    background-color: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid #e5e7eb;
    padding: 16px;
    position: sticky;
    top: 0;
    z-index: 40;
    backdrop-filter: blur(12px);
  }
  .dark .header {
    background-color: rgba(31, 41, 55, 0.95);
    border-bottom-color: #374151;
  }
  .header-container {
    max-width: 1152px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(to bottom right, #4f46e5, #7c3aed);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .logo-text {
    font-size: 24px;
    font-weight: bold;
    background: linear-gradient(to right, #4f46e5, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  /* Button Styles */
  .btn {
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-theme {
    padding: 10px;
    border-radius: 12px;
    background-color: #f3f4f6;
  }
  .dark .btn-theme {
    background-color: #374151;
  }
  .btn-theme:hover {
    background-color: #e5e7eb;
  }
  .dark .btn-theme:hover {
    background-color: #4b5563;
  }
  .btn-clear {
    padding: 10px 16px;
    border-radius: 12px;
    background-color: transparent;
    color: #ef4444;
    border: 1px solid #ef4444;
    font-size: 14px;
  }
  .dark .btn-clear {
    color: #f87171;
    border-color: #f87171;
  }
  .btn-clear:hover {
    background-color: #fee2e2;
  }
  .dark .btn-clear:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }
  .btn-primary {
    background: linear-gradient(to right, #4f46e5, #7c3aed);
    color: white;
    padding: 10px 20px;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .btn-primary:hover {
    background: linear-gradient(to right, #4338ca, #6d28d9);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }
  /* Main Content */
  .main-content {
    max-width: 1152px;
    margin: 0 auto;
    padding: 32px 16px;
  }
  /* Search and Filter Bar */
  .search-filter-bar {
    margin-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .search-container {
    position: relative;
    flex: 1;
  }
  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }
  .search-input {
    width: 100%;
    padding: 12px 16px 12px 48px;
    border-radius: 12px;
    border: 1px solid #d1d5db;
    background-color: white;
    color: #111827;
    outline: none;
    transition: all 0.2s ease;
    font-size: 16px;
  }
  .dark .search-input {
    border-color: #374151;
    background-color: #1f2937;
    color: #f3f4f6;
  }
  .search-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
  .filter-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-btn {
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #d1d5db;
    background-color: white;
    color: #374151;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .dark .filter-btn {
    border-color: #374151;
    background-color: #1f2937;
    color: #d1d5db;
  }
  .filter-btn.active {
    background-color: #4f46e5;
    color: white;
    border-color: #4f46e5;
  }
  .filter-btn:hover:not(.active) {
    border-color: #4f46e5;
  }
  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 80px 0;
  }
  .empty-icon {
    width: 80px;
    height: 80px;
    background-color: #f3f4f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  .dark .empty-icon {
    background-color: #1f2937;
  }
  .empty-text {
    color: #6b7280;
    font-size: 18px;
  }
  .dark .empty-text {
    color: #9ca3af;
  }
  /* Notes Grid */
  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
  /* Note Card */
  .note-card {
    background-color: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border: 2px solid transparent;
    transition: all 0.3s ease;
    position: relative;
  }
  .dark .note-card {
    background-color: #1f2937;
  }
  .note-card:hover {
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.15);
    border-color: #e0e7ff;
  }
  .dark .note-card:hover {
    border-color: #3730a3;
  }
  .note-card.completed {
    opacity: 0.75;
    border-color: #86efac;
  }
  .dark .note-card.completed {
    border-color: #166534;
  }
  .note-checkbox {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    border: 2px solid #d1d5db;
    background-color: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .dark .note-checkbox {
    border-color: #4b5563;
  }
  .note-checkbox.checked {
    background-color: #22c55e;
    border-color: #22c55e;
  }
  .note-checkbox:hover {
    border-color: #4f46e5;
  }
  .note-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 12px;
    padding-right: 32px;
    color: #111827;
  }
  .dark .note-title {
    color: #f3f4f6;
  }
  .note-title.completed {
    text-decoration: line-through;
    color: #9ca3af;
  }
  .note-description {
    font-size: 14px;
    margin-bottom: 16px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .dark .note-description {
    color: #9ca3af;
  }
  .note-description.completed {
    color: #9ca3af;
  }
  .dark .note-description.completed {
    color: #4b5563;
  }
  .note-actions {
    display: flex;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .note-card:hover .note-actions {
    opacity: 1;
  }
  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  .action-btn-edit {
    background-color: #eef2ff;
    color: #4f46e5;
  }
  .dark .action-btn-edit {
    background-color: rgba(79, 70, 229, 0.2);
    color: #818cf8;
  }
  .action-btn-edit:hover {
    background-color: #e0e7ff;
  }
  .dark .action-btn-edit:hover {
    background-color: rgba(79, 70, 229, 0.3);
  }
  .action-btn-delete {
    background-color: #fee2e2;
    color: #ef4444;
  }
  .dark .action-btn-delete {
    background-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  .action-btn-delete:hover {
    background-color: #fecaca;
  }
  .dark .action-btn-delete:hover {
    background-color: rgba(239, 68, 68, 0.3);
  }
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
  .modal-content {
    background-color: white;
    border-radius: 16px;
    width: 100%;
    max-width: 512px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  .dark .modal-content {
    background-color: #1f2937;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .modal-title {
    font-size: 24px;
    font-weight: bold;
    color: #111827;
  }
  .dark .modal-title {
    color: #f3f4f6;
  }
  .modal-close {
    padding: 8px;
    border-radius: 8px;
    background-color: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .modal-close:hover {
    background-color: #f3f4f6;
  }
  .dark .modal-close:hover {
    background-color: #374151;
  }
  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
  }
  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }
  .dark .form-label {
    color: #d1d5db;
  }
  .form-input {
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #d1d5db;
    background-color: white;
    color: #111827;
    outline: none;
    transition: all 0.2s ease;
    font-size: 16px;
    font-family: inherit;
  }
  .dark .form-input {
    border-color: #374151;
    background-color: #111827;
    color: #f3f4f6;
  }
  .form-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
  .form-textarea {
    resize: none;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }
  .btn-cancel {
    flex: 1;
    padding: 12px 16px;
    background-color: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .dark .btn-cancel {
    background-color: #374151;
    color: #d1d5db;
  }
  .btn-cancel:hover {
    background-color: #e5e7eb;
  }
  .dark .btn-cancel:hover {
    background-color: #4b5563;
  }
  .btn-save {
    flex: 1;
    padding: 12px 16px;
    background: linear-gradient(to right, #4f46e5, #7c3aed);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .btn-save:hover:not(:disabled) {
    background: linear-gradient(to right, #4338ca, #6d28d9);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }
  .btn-save:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.5;
  }
  /* Responsive */
  @media (max-width: 640px) {
    .header-logo {
      font-size: 18px;
    }
    .btn-primary span {
      display: none;
    }
    .notes-grid {
      grid-template-columns: 1fr;
    }
    .search-filter-bar {
      flex-direction: column;
    }
  }
`;
