import React, { useState, useEffect, useRef, useMemo } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type NoteColor = 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'orange' | 'gray';
type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface NotesData {
  notes: Note[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const isClient = typeof window !== 'undefined';

const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  green: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  blue: { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a' },
  purple: { bg: '#e9d5ff', border: '#8b5cf6', text: '#5b21b6' },
  pink: { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
  orange: { bg: '#fed7aa', border: '#f97316', text: '#7c2d12' },
  gray: { bg: '#e5e7eb', border: '#6b7280', text: '#1f2937' },
};

const DEFAULT_NOTES: Note[] = [
  {
    id: 'note_1',
    title: 'Bem-vindo ao Notes! 📝',
    content: 'Este é um exemplo de nota. Você pode criar, editar, excluir e organizar suas anotações.\n\nRecursos:\n• Busca e filtros avançados\n• Tags para organização\n• Fixar notas importantes\n• Múltiplas cores\n• Tema claro/escuro',
    color: 'yellow',
    isPinned: true,
    tags: ['tutorial', 'importante'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'note_2',
    title: 'Lista de Tarefas',
    content: '• Implementar novo feature\n• Revisar código\n• Fazer deploy\n• Documentar API',
    color: 'green',
    isPinned: false,
    tags: ['trabalho', 'tarefas'],
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
];

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'notes_darkMode',
    NOTES: 'notes_data',
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

// ============================================================================
// MODEL LAYER
// ============================================================================

/**
 * Notes Model - Handles data structure and business logic
 */
class NotesModel {
  private notes: Note[];

  constructor(initialNotes?: Note[]) {
    this.notes = initialNotes || [...DEFAULT_NOTES];
  }

  /**
   * Get all notes
   */
  getAllNotes(): Note[] {
    return [...this.notes];
  }

  /**
   * Get note by ID
   */
  getNoteById(id: string): Note | null {
    return this.notes.find(n => n.id === id) || null;
  }

  /**
   * Add new note
   */
  addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
    const newNote: Note = {
      ...note,
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.notes.unshift(newNote);
    return newNote;
  }

  /**
   * Update existing note
   */
  updateNote(id: string, updates: Partial<Note>): Note | null {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return null;

    this.notes[index] = {
      ...this.notes[index],
      ...updates,
      updatedAt: Date.now(),
    };
    return this.notes[index];
  }

  /**
   * Delete note by ID
   */
  deleteNote(id: string): boolean {
    const initialLength = this.notes.length;
    this.notes = this.notes.filter(n => n.id !== id);
    return this.notes.length < initialLength;
  }

  /**
   * Toggle pin status
   */
  togglePin(id: string): Note | null {
    const note = this.notes.find(n => n.id === id);
    if (!note) return null;

    note.isPinned = !note.isPinned;
    note.updatedAt = Date.now();

    // Move pinned notes to top
    if (note.isPinned) {
      this.notes = this.notes.filter(n => n.id !== id);
      this.notes.unshift(note);
    }

    return note;
  }

  /**
   * Search notes by term (searches in title, content, and tags)
   */
  searchNotes(term: string): Note[] {
    const lowerTerm = term.toLowerCase();
    return this.notes.filter(n =>
      n.title.toLowerCase().includes(lowerTerm) ||
      n.content.toLowerCase().includes(lowerTerm) ||
      n.tags.some(tag => tag.toLowerCase().includes(lowerTerm))
    );
  }

  /**
   * Filter notes by color
   */
  filterByColor(color: NoteColor): Note[] {
    return this.notes.filter(n => n.color === color);
  }

  /**
   * Filter notes by tag
   */
  filterByTag(tag: string): Note[] {
    return this.notes.filter(n => n.tags.includes(tag));
  }

  /**
   * Get all unique tags from notes
   */
  getAllTags(): string[] {
    const tagsSet = new Set<string>();
    this.notes.forEach(note => {
      note.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }

  /**
   * Sort notes by specified option
   */
  sortNotes(notes: Note[], sortBy: SortOption): Note[] {
    const sorted = [...notes];

    // Always keep pinned notes at the top
    const pinned = sorted.filter(n => n.isPinned);
    const unpinned = sorted.filter(n => !n.isPinned);

    const sortFunction = (arr: Note[]) => {
      switch (sortBy) {
        case 'date-desc':
          return arr.sort((a, b) => b.updatedAt - a.updatedAt);
        case 'date-asc':
          return arr.sort((a, b) => a.updatedAt - b.updatedAt);
        case 'title-asc':
          return arr.sort((a, b) => a.title.localeCompare(b.title));
        case 'title-desc':
          return arr.sort((a, b) => b.title.localeCompare(a.title));
        default:
          return arr;
      }
    };

    return [...sortFunction(pinned), ...sortFunction(unpinned)];
  }

  /**
   * Sync to storage
   */
  syncToStorage(): void {
    StorageService.saveToStorage(StorageService.getKeys().NOTES, {
      notes: this.notes,
    });
  }

  /**
   * Load from storage
   */
  static loadFromStorage(): NotesModel {
    const data = StorageService.loadFromStorage<NotesData | null>(
      StorageService.getKeys().NOTES,
      null
    );
    return new NotesModel(data?.notes);
  }
}

// ============================================================================
// CONTROLLER LAYER
// ============================================================================

/**
 * Notes Controller - Manages state and coordinates between Model and View
 */
class NotesController {
  private model: NotesModel;
  private listeners: Set<() => void>;

  constructor(model: NotesModel) {
    this.model = model;
    this.listeners = new Set();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
    this.model.syncToStorage();
  }

  // ==================== NOTE OPERATIONS ====================

  getAllNotes(): Note[] {
    return this.model.getAllNotes();
  }

  getNoteById(id: string): Note | null {
    return this.model.getNoteById(id);
  }

  addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.model.addNote(note);
    this.notify();
  }

  updateNote(id: string, updates: Partial<Note>): void {
    this.model.updateNote(id, updates);
    this.notify();
  }

  deleteNote(id: string): void {
    this.model.deleteNote(id);
    this.notify();
  }

  togglePin(id: string): void {
    this.model.togglePin(id);
    this.notify();
  }

  // ==================== SEARCH & FILTER ====================

  searchNotes(term: string): Note[] {
    return this.model.searchNotes(term);
  }

  filterByColor(color: NoteColor): Note[] {
    return this.model.filterByColor(color);
  }

  filterByTag(tag: string): Note[] {
    return this.model.filterByTag(tag);
  }

  getAllTags(): string[] {
    return this.model.getAllTags();
  }

  sortNotes(notes: Note[], sortBy: SortOption): Note[] {
    return this.model.sortNotes(notes, sortBy);
  }
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

/**
 * Header Component with theme toggle
 */
const Header: React.FC<{
  darkMode: boolean;
  toggleTheme: () => void;
  onAddNote: () => void;
  noteCount: number;
}> = ({ darkMode, toggleTheme, onAddNote, noteCount }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <div>
            <h1>Notes</h1>
            <span className="note-count">{noteCount} {noteCount === 1 ? 'nota' : 'notas'}</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={onAddNote} className="btn-add-note">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Nota
          </button>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {darkMode ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

/**
 * Search and Filter Bar Component
 */
const FilterBar: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedColor: NoteColor | null;
  onColorFilter: (color: NoteColor | null) => void;
  selectedTag: string | null;
  onTagFilter: (tag: string | null) => void;
  tags: string[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}> = ({
  searchTerm,
  onSearchChange,
  selectedColor,
  onColorFilter,
  selectedTag,
  onTagFilter,
  tags,
  sortBy,
  onSortChange
}) => {
    return (
      <div className="filter-bar">
        <div className="search-box">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar notas..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => onSearchChange('')} className="clear-search">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="filters-row">
          <div className="color-filters">
            <span className="filter-label">Cor:</span>
            <button
              onClick={() => onColorFilter(null)}
              className={`color-filter-btn ${!selectedColor ? 'active' : ''}`}
            >
              Todas
            </button>
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map(color => (
              <button
                key={color}
                onClick={() => onColorFilter(selectedColor === color ? null : color)}
                className={`color-filter ${selectedColor === color ? 'active' : ''}`}
                style={{ backgroundColor: NOTE_COLORS[color].bg, borderColor: NOTE_COLORS[color].border }}
                title={color}
              />
            ))}
          </div>

          {tags.length > 0 && (
            <div className="tag-filters">
              <span className="filter-label">Tag:</span>
              <button
                onClick={() => onTagFilter(null)}
                className={`tag-filter ${!selectedTag ? 'active' : ''}`}
              >
                Todas
              </button>
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => onTagFilter(selectedTag === tag ? null : tag)}
                  className={`tag-filter ${selectedTag === tag ? 'active' : ''}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <div className="sort-select">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <select value={sortBy} onChange={e => onSortChange(e.target.value as SortOption)}>
              <option value="date-desc">Mais recentes</option>
              <option value="date-asc">Mais antigas</option>
              <option value="title-asc">Título (A-Z)</option>
              <option value="title-desc">Título (Z-A)</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

/**
 * Note Card Component
 */
const NoteCard: React.FC<{
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}> = ({ note, onEdit, onDelete, onTogglePin }) => {
  const colors = NOTE_COLORS[note.color];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div
      className="note-card"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      onClick={onEdit}
    >
      {note.isPinned && (
        <div className="pin-badge">
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </div>
      )}

      <div className="note-card-header">
        <h3 className="note-title" style={{ color: colors.text }}>{note.title}</h3>
        <div className="note-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="note-action-btn"
            style={{ color: colors.text }}
            aria-label={note.isPinned ? 'Desafixar' : 'Fixar'}
          >
            <svg fill={note.isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="note-action-btn"
            style={{ color: colors.text }}
            aria-label="Excluir"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <p className="note-content" style={{ color: colors.text }}>
        {note.content.length > 200 ? `${note.content.substring(0, 200)}...` : note.content}
      </p>

      <div className="note-footer">
        <div className="note-tags">
          {note.tags.map(tag => (
            <span key={tag} className="note-tag" style={{ backgroundColor: colors.border, color: '#fff' }}>
              #{tag}
            </span>
          ))}
        </div>
        <span className="note-date" style={{ color: colors.text }}>
          {formatDate(note.updatedAt)}
        </span>
      </div>
    </div>
  );
};

/**
 * Note Editor Modal
 */
const NoteEditorModal: React.FC<{
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
}> = ({ isOpen, note, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        setColor(note.color);
        setTags(note.tags);
      } else {
        setTitle('');
        setContent('');
        setColor('yellow');
        setTags([]);
      }
      setTagInput('');
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, note]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      content: content.trim(),
      color,
      isPinned: note?.isPinned || false,
      tags,
    });
    onClose();
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal note-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{note ? 'Editar Nota' : 'Nova Nota'}</h2>
          <button onClick={onClose} className="modal-close">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="note-editor-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Digite o título da nota"
              required
            />
          </div>

          <div className="form-group">
            <label>Conteúdo</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Digite o conteúdo da nota..."
              rows={8}
            />
          </div>

          <div className="form-group">
            <label>Cor da Nota</label>
            <div className="color-picker">
              {(Object.keys(NOTE_COLORS) as NoteColor[]).map(noteColor => (
                <button
                  key={noteColor}
                  type="button"
                  className={`color-option ${color === noteColor ? 'selected' : ''}`}
                  style={{
                    backgroundColor: NOTE_COLORS[noteColor].bg,
                    borderColor: NOTE_COLORS[noteColor].border,
                  }}
                  onClick={() => setColor(noteColor)}
                  title={noteColor}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tags-input-container">
              <div className="tags-display">
                {tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="tag-remove"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="tag-input-wrapper">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Adicionar tag..."
                />
                <button type="button" onClick={handleAddTag} className="btn-add-tag">
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {note ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Empty State Component
 */
const EmptyState: React.FC<{ message: string; showAddButton?: boolean; onAddNote?: () => void }> = ({
  message,
  showAddButton,
  onAddNote
}) => {
  return (
    <div className="empty-state">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p>{message}</p>
      {showAddButton && onAddNote && (
        <button onClick={onAddNote} className="btn-primary">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar Primeira Nota
        </button>
      )}
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  // Initialize dark mode from storage
  const [darkMode, setDarkMode] = useState(() => {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  });

  // Initialize controller with model loaded from storage
  const [controller] = useState(() => {
    const model = NotesModel.loadFromStorage();
    return new NotesController(model);
  });

  // State management - CORRIGIDO: usar contador numérico em vez de objeto
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<NoteColor | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [editorModal, setEditorModal] = useState<{ isOpen: boolean; note: Note | null }>({
    isOpen: false,
    note: null,
  });

  // Subscribe to controller changes - CORRIGIDO: usar setUpdateTrigger
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      setUpdateTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [controller]);

  // Update dark mode in DOM and storage
  useEffect(() => {
    if (isClient) {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, darkMode);
    }
  }, [darkMode]);

  // Get data from controller
  const allTags = controller.getAllTags();

  // Compute filtered and sorted notes - CORRIGIDO: adicionar updateTrigger às dependências
  const displayedNotes = useMemo(() => {
    let notes = controller.getAllNotes();

    // Apply search filter
    if (searchTerm) {
      notes = controller.searchNotes(searchTerm).filter(n =>
        notes.some(note => note.id === n.id)
      );
    }

    // Apply color filter
    if (selectedColor) {
      notes = controller.filterByColor(selectedColor).filter(n =>
        notes.some(note => note.id === n.id)
      );
    }

    // Apply tag filter
    if (selectedTag) {
      notes = controller.filterByTag(selectedTag).filter(n =>
        notes.some(note => note.id === n.id)
      );
    }

    // Apply sorting
    return controller.sortNotes(notes, sortBy);
  }, [controller, searchTerm, selectedColor, selectedTag, sortBy, updateTrigger]);

  // Handlers
  const toggleTheme = () => setDarkMode(!darkMode);

  const handleAddNote = () => {
    setEditorModal({ isOpen: true, note: null });
  };

  const handleEditNote = (note: Note) => {
    setEditorModal({ isOpen: true, note });
  };

  const handleSaveNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editorModal.note) {
      controller.updateNote(editorModal.note.id, noteData);
    } else {
      controller.addNote(noteData);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Deseja realmente excluir esta nota?')) {
      controller.deleteNote(noteId);
    }
  };

  const handleTogglePin = (noteId: string) => {
    controller.togglePin(noteId);
  };

  const allNotes = controller.getAllNotes();
  const hasNotes = allNotes.length > 0;

  return (
    <div className="app">
      <Header
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        onAddNote={handleAddNote}
        noteCount={allNotes.length}
      />

      {hasNotes && (
        <FilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedColor={selectedColor}
          onColorFilter={setSelectedColor}
          selectedTag={selectedTag}
          onTagFilter={setSelectedTag}
          tags={allTags}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      <main className="main-content">
        {!hasNotes ? (
          <EmptyState
            message="Nenhuma nota criada ainda"
            showAddButton
            onAddNote={handleAddNote}
          />
        ) : displayedNotes.length === 0 ? (
          <EmptyState
            message={
              searchTerm
                ? `Nenhuma nota encontrada para "${searchTerm}"`
                : selectedColor
                  ? 'Nenhuma nota com esta cor'
                  : selectedTag
                    ? `Nenhuma nota com a tag #${selectedTag}`
                    : 'Nenhuma nota encontrada'
            }
          />
        ) : (
          <div className="notes-grid">
            {displayedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => handleEditNote(note)}
                onDelete={() => handleDeleteNote(note.id)}
                onTogglePin={() => handleTogglePin(note.id)}
              />
            ))}
          </div>
        )}
      </main>

      <NoteEditorModal
        isOpen={editorModal.isOpen}
        note={editorModal.note}
        onClose={() => setEditorModal({ isOpen: false, note: null })}
        onSave={handleSaveNote}
      />
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const APP_STYLES = `
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  
  --bg: #f8fafc;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.1);
  --shadow-lg: rgba(0, 0, 0, 0.15);
  
  --header-bg: #ffffff;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-lg: rgba(0, 0, 0, 0.5);
  
  --header-bg: #1e293b;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header Styles */
.header {
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background-color 0.3s ease;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.header-title h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
}

.note-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-add-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add-note:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-add-note svg {
  width: 20px;
  height: 20px;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.theme-toggle:hover {
  transform: scale(1.05);
  background: var(--primary);
  color: white;
}

.theme-toggle svg {
  width: 20px;
  height: 20px;
}

/* Filter Bar */
.filter-bar {
  background: var(--header-bg);
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.search-box input {
  width: 100%;
  padding: 0.75rem 3rem 0.75rem 3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.9375rem;
  transition: all 0.2s ease;
}

.search-box input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.clear-search {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: var(--border);
  color: var(--text);
}

.clear-search svg {
  width: 16px;
  height: 16px;
}

.filters-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  align-items: center;
}

.color-filters,
.tag-filters {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.color-filter-btn {
  padding: 0.5rem 1rem;
  border: 2px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-filter-btn:hover,
.color-filter-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.color-filter {
  width: 32px;
  height: 32px;
  border: 2px solid;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-filter:hover {
  transform: scale(1.1);
}

.color-filter.active {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary);
  transform: scale(1.15);
}

.tag-filter {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-filter:hover {
  background: var(--border);
}

.tag-filter.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.sort-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.sort-select svg {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.sort-select select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-select select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Main Content */
.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* Note Card */
.note-card {
  border-radius: 12px;
  padding: 1.25rem;
  border: 2px solid;
  box-shadow: 0 2px 8px var(--shadow);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.note-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.pin-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}

.pin-badge svg {
  width: 16px;
  height: 16px;
}

.note-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.note-title {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 700;
  word-break: break-word;
}

.note-actions {
  display: flex;
  gap: 0.25rem;
}

.note-action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.note-action-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.1);
}

.note-action-btn svg {
  width: 16px;
  height: 16px;
}

.note-content {
  font-size: 0.9375rem;
  line-height: 1.6;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.note-tag {
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.note-date {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.8;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--danger);
  color: white;
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.note-editor-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text);
  font-size: 0.875rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 0.9375rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 150px;
}

.color-picker {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.color-option {
  width: 48px;
  height: 48px;
  border: 3px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary);
  transform: scale(1.15);
}

.tags-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--primary);
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.tag-remove {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.tag-remove:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tag-remove svg {
  width: 10px;
  height: 10px;
}

.tag-input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.tag-input-wrapper input {
  flex: 1;
}

.btn-add-tag {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  background: var(--border);
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-add-tag:hover {
  background: var(--text-secondary);
  color: white;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9375rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

.btn-primary svg,
.btn-secondary svg {
  width: 16px;
  height: 16px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  min-height: 400px;
}

.empty-state svg {
  width: 80px;
  height: 80px;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-bottom: 1.5rem;
}

.empty-state p {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
  }
  
  .header-title h1 {
    font-size: 1.25rem;
  }
  
  .btn-add-note span {
    display: none;
  }
  
  .filter-bar {
    padding: 1rem;
  }
  
  .filters-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .sort-select {
    margin-left: 0;
    width: 100%;
  }
  
  .sort-select select {
    flex: 1;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .notes-grid {
    grid-template-columns: 1fr;
  }
  
  .modal {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.note-card {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
`;

// ============================================================================
// SSR SETUP & EXPORT
// ============================================================================

// Inject styles into document
if (isClient) {
  const styleId = 'app-styles';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = APP_STYLES;
    document.head.appendChild(styleElement);
  }
}

export default App;
