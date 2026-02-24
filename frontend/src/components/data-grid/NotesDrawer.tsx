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
  Stack,
  ImageList,
  ImageListItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Slider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownToolbar, type MarkdownFormat } from './MarkdownToolbar';
import { noteAttachmentAPI } from '../../api/api';
import type { NoteAttachment } from '../../api/types';

export interface NotesDrawerProps {
  open: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
  noteId?: number;
}

const MAX_SIDE = 1280;

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = URL.createObjectURL(file);
  });
}

async function renderProcessedFile(file: File, zoom = 1, offsetX = 0, offsetY = 0): Promise<File> {
  const image = await fileToImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const cropWidth = image.width / zoom;
  const cropHeight = image.height / zoom;
  const maxOffsetX = (image.width - cropWidth) / 2;
  const maxOffsetY = (image.height - cropHeight) / 2;
  const sourceX = (image.width - cropWidth) / 2 + Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const sourceY = (image.height - cropHeight) / 2 + Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) reject(new Error('Failed to encode image'));
      else resolve(result);
    }, 'image/webp', 0.85);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

export function NotesDrawer({ open, title, value, onChange, onSave, onClose, loading = false, noteId }: NotesDrawerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = async (): Promise<void> => {
    if (!noteId) return;
    const response = await noteAttachmentAPI.list(noteId);
    setAttachments(response.data);
  };

  useEffect(() => {
    if (open) {
      setActiveTab('edit');
      void loadAttachments();
    }
  }, [open, noteId]);

  const handleFormat = (format: MarkdownFormat): void => {
    if (!textFieldRef.current) return;
    const textarea = textFieldRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    let newText = '';
    switch (format) {
      case 'bold': newText = `${beforeText}**${selectedText || 'fetter Text'}**${afterText}`; break;
      case 'italic': newText = `${beforeText}_${selectedText || 'kursiver Text'}_${afterText}`; break;
      case 'code': newText = `${beforeText}\`${selectedText || 'Code'}\`${afterText}`; break;
      case 'heading': newText = `${beforeText}## ${selectedText || 'Überschrift'}${afterText}`; break;
      case 'bullet-list': newText = `${beforeText}- ${selectedText || 'Listeneintrag'}${afterText}`; break;
      case 'numbered-list': newText = `${beforeText}1. ${selectedText || 'Listeneintrag'}${afterText}`; break;
      case 'link': newText = `${beforeText}[${selectedText || 'Linktext'}](url)${afterText}`; break;
      case 'quote': newText = `${beforeText}> ${selectedText || 'Zitat'}${afterText}`; break;
      default: return;
    }
    onChange(newText);
  };

  const handleUpload = async (file: File): Promise<void> => {
    if (!noteId) return;
    setUploading(true);
    try {
      const processed = await renderProcessedFile(file, zoom, offsetX, offsetY);
      await noteAttachmentAPI.upload(noteId, processed, '', setUploadProgress);
      await loadAttachments();
      setPendingFile(null);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: '680px' }, maxWidth: '95vw' } }}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }} onKeyDown={handleKeyDown}>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tab label="Bearbeiten" value="edit" />
          <Tab label="Vorschau" value="preview" />
        </Tabs>

        {noteId && (
          <Box sx={{ mb: 2 }}>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPendingFile(file);
            }} />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>Foto hinzufügen</Button>
              {uploading && <Typography variant="body2">Uploading...</Typography>}
            </Stack>
            {uploading && <LinearProgress variant="determinate" value={uploadProgress} />}
            <ImageList cols={4} rowHeight={84}>
              {attachments.map((attachment) => (
                <ImageListItem key={attachment.id}>
                  <img src={attachment.image_url ?? attachment.image} alt={attachment.caption || 'Attachment'} loading="lazy" style={{ cursor: 'pointer' }} onClick={() => setSelectedImage(attachment.image_url ?? attachment.image)} />
                  <IconButton size="small" sx={{ position: 'absolute', right: 2, top: 2, bgcolor: 'rgba(0,0,0,0.4)', color: 'white' }} onClick={async () => {
                    await noteAttachmentAPI.delete(attachment.id);
                    await loadAttachments();
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        )}

        <Box sx={{ flexGrow: 1, mb: 2, overflow: 'auto' }}>
          {activeTab === 'edit' ? (
            <>
              <MarkdownToolbar onFormat={handleFormat} />
              <TextField fullWidth multiline minRows={10} maxRows={25} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Notizen in Markdown..." variant="outlined" autoFocus inputRef={textFieldRef} />
            </>
          ) : (
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, minHeight: '300px' }}>
              {value ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown> : <Typography color="text.secondary" fontStyle="italic">Keine Notizen vorhanden</Typography>}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading} variant="outlined">Abbrechen</Button>
          <Button onClick={onSave} disabled={loading} variant="contained" color="primary" startIcon={loading ? <CircularProgress size={16} /> : undefined}>Speichern</Button>
        </Box>
      </Box>

      <Dialog open={Boolean(selectedImage)} onClose={() => setSelectedImage(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Foto</DialogTitle>
        <DialogContent>{selectedImage && <img src={selectedImage} style={{ width: '100%' }} alt="Attachment preview" />}</DialogContent>
        <DialogActions><Button onClick={() => setSelectedImage(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingFile)} onClose={() => setPendingFile(null)} maxWidth="md" fullWidth>
        <DialogTitle>Crop</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>Optional crop with zoom and drag offsets before upload.</Typography>
          <Slider min={1} max={3} step={0.1} value={zoom} onChange={(_, v) => setZoom(v as number)} valueLabelDisplay="auto" />
          <Slider min={-800} max={800} step={5} value={offsetX} onChange={(_, v) => setOffsetX(v as number)} valueLabelDisplay="auto" />
          <Slider min={-800} max={800} step={5} value={offsetY} onChange={(_, v) => setOffsetY(v as number)} valueLabelDisplay="auto" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }}>Reset</Button>
          <Button onClick={() => { if (pendingFile) void handleUpload(pendingFile); }} disabled={uploading} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
