/**
 * NotesDrawer component for editing markdown notes.
 * 
 * Provides a side drawer with tabs for editing and previewing markdown.
 * Includes formatting toolbar, save/cancel actions and keyboard shortcuts.
 */

import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownToolbar, type MarkdownFormat } from './MarkdownToolbar';

export interface NotesDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Title to display in drawer header */
  title: string;
  /** Current value of the notes */
  value: string;
  /** Handler called when value changes */
  onChange: (value: string) => void;
  /** Handler called when save button is clicked */
  onSave: () => void;
  /** Handler called when cancel/close is requested */
  onClose: () => void;
  /** Whether save operation is in progress */
  loading?: boolean;
}

/**
 * Drawer component for editing markdown notes with preview.
 */
export function NotesDrawer({
  open,
  title,
  value,
  onChange,
  onSave,
  onClose,
  loading = false,
}: NotesDrawerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  // Reset to edit tab when drawer opens
  useEffect(() => {
    if (open) {
      setActiveTab('edit');
    }
  }, [open]);

  /**
   * Handle markdown formatting
   */
  const handleFormat = (format: MarkdownFormat): void => {
    if (!textFieldRef.current) return;

    const textarea = textFieldRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    let newText = '';
    let newCursorPos = start;

    switch (format) {
      case 'bold':
        newText = `${beforeText}**${selectedText || 'fetter Text'}**${afterText}`;
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'italic':
        newText = `${beforeText}_${selectedText || 'kursiver Text'}_${afterText}`;
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'code':
        newText = `${beforeText}\`${selectedText || 'Code'}\`${afterText}`;
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'heading':
        newText = `${beforeText}## ${selectedText || 'Überschrift'}${afterText}`;
        newCursorPos = selectedText ? end + 3 : start + 3;
        break;
      case 'bullet-list':
        if (selectedText) {
          const lines = selectedText.split('\n');
          const bulletedLines = lines.map(line => `- ${line}`).join('\n');
          newText = `${beforeText}${bulletedLines}${afterText}`;
          newCursorPos = end + (lines.length * 2);
        } else {
          newText = `${beforeText}- Listeneintrag${afterText}`;
          newCursorPos = start + 2;
        }
        break;
      case 'numbered-list':
        if (selectedText) {
          const lines = selectedText.split('\n');
          const numberedLines = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
          newText = `${beforeText}${numberedLines}${afterText}`;
          newCursorPos = end + (lines.length * 3);
        } else {
          newText = `${beforeText}1. Listeneintrag${afterText}`;
          newCursorPos = start + 3;
        }
        break;
      case 'link':
        newText = `${beforeText}[${selectedText || 'Linktext'}](url)${afterText}`;
        newCursorPos = selectedText ? start + selectedText.length + 3 : start + 1;
        break;
      case 'quote':
        if (selectedText) {
          const lines = selectedText.split('\n');
          const quotedLines = lines.map(line => `> ${line}`).join('\n');
          newText = `${beforeText}${quotedLines}${afterText}`;
          newCursorPos = end + (lines.length * 2);
        } else {
          newText = `${beforeText}> Zitat${afterText}`;
          newCursorPos = start + 2;
        }
        break;
      default:
        return;
    }

    onChange(newText);

    // Restore cursor position after React re-renders
    setTimeout(() => {
      if (textFieldRef.current) {
        textFieldRef.current.focus();
        textFieldRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Ctrl+B for bold
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      handleFormat('bold');
    }
    // Ctrl+I for italic
    if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
      event.preventDefault();
      handleFormat('italic');
    }
    // Ctrl+Enter or Cmd+Enter to save
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
    // Escape to close
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '600px' },
          maxWidth: '90vw',
        },
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: 3,
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Bearbeiten" value="edit" />
          <Tab label="Vorschau" value="preview" />
        </Tabs>

        {/* Content */}
        <Box sx={{ flexGrow: 1, mb: 2, overflow: 'auto' }}>
          {activeTab === 'edit' ? (
            <>
              <MarkdownToolbar onFormat={handleFormat} />
              <TextField
                fullWidth
                multiline
                minRows={10}
                maxRows={25}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Notizen in Markdown..."
                variant="outlined"
                autoFocus
                inputRef={textFieldRef}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  },
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                minHeight: '300px',
                backgroundColor: 'background.paper',
                overflow: 'auto',
              }}
            >
              {value ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Disable HTML rendering for security
                    html: () => null,
                  }}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <Typography color="text.secondary" fontStyle="italic">
                  Keine Notizen vorhanden
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            disabled={loading}
            variant="outlined"
          >
            Abbrechen
          </Button>
          <Button
            onClick={onSave}
            disabled={loading}
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            Speichern
          </Button>
        </Box>

        {/* Keyboard shortcuts hint */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, textAlign: 'center' }}
        >
          Strg+B: Fett • Strg+I: Kursiv • Strg+Enter: Speichern • Esc: Schließen
        </Typography>
      </Box>
    </Drawer>
  );
}
