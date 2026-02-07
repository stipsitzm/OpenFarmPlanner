/**
 * NotesDrawer component for editing markdown notes.
 * 
 * Provides a side drawer with tabs for editing and previewing markdown.
 * Includes save/cancel actions and keyboard shortcuts.
 */

import { useState, useEffect } from 'react';
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

  // Reset to edit tab when drawer opens
  useEffect(() => {
    if (open) {
      setActiveTab('edit');
    }
  }, [open]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
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
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                },
              }}
            />
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
          Strg+Enter: Speichern • Esc: Schließen
        </Typography>
      </Box>
    </Drawer>
  );
}
