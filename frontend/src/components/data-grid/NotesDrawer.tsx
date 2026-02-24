import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
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
  Alert,
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
const MIN_CROP_SIZE = 24;

type CropRect = { x: number; y: number; width: number; height: number };
type DragMode = 'draw' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = URL.createObjectURL(file);
  });
}

async function renderProcessedFile(file: File, cropRect?: CropRect): Promise<File> {
  const image = await fileToImage(file);
  const crop = cropRect ?? { x: 0, y: 0, width: image.width, height: image.height };

  const rawWidth = Math.max(1, Math.round(crop.width));
  const rawHeight = Math.max(1, Math.round(crop.height));
  const scale = Math.min(1, MAX_SIDE / Math.max(rawWidth, rawHeight));
  const targetWidth = Math.max(1, Math.round(rawWidth * scale));
  const targetHeight = Math.max(1, Math.round(rawHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, targetWidth, targetHeight);

  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (webp) {
    return new File([webp], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  }

  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!jpeg) throw new Error('Failed to encode image');
  return new File([jpeg], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}

export function NotesDrawer({ open, title, value, onChange, onSave, onClose, loading = false, noteId }: NotesDrawerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; initialRect: CropRect } | null>(null);

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

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const clearPendingSelection = (): void => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setCropRect(null);
    setSourceSize(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const openCropDialog = (file: File): void => {
    const nextUrl = URL.createObjectURL(file);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setUploadError('');
    setPendingFile(file);
    setPendingPreviewUrl(nextUrl);
    setCropRect(null);
    setSourceSize(null);
  };

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

  const imagePointFromEvent = (event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const img = cropImageRef.current;
    if (!img) return null;
    const bounds = img.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  const onCropPointerDown = (event: ReactPointerEvent<HTMLDivElement>, mode: DragMode): void => {
    if (event.button !== 0) return;
    const point = imagePointFromEvent(event);
    if (!point) return;
    const initial = cropRect ?? { x: point.x, y: point.y, width: 1, height: 1 };
    dragRef.current = { mode, startX: point.x, startY: point.y, initialRect: initial };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current || !cropImageRef.current) return;
    const point = imagePointFromEvent(event);
    if (!point) return;
    const bounds = cropImageRef.current.getBoundingClientRect();
    const { mode, startX, startY, initialRect } = dragRef.current;

    let next: CropRect = { ...initialRect };

    if (mode === 'draw') {
      next = {
        x: Math.min(startX, point.x),
        y: Math.min(startY, point.y),
        width: Math.max(MIN_CROP_SIZE, Math.abs(point.x - startX)),
        height: Math.max(MIN_CROP_SIZE, Math.abs(point.y - startY)),
      };
    }

    if (mode === 'move') {
      next = {
        ...initialRect,
        x: Math.max(0, Math.min(bounds.width - initialRect.width, initialRect.x + (point.x - startX))),
        y: Math.max(0, Math.min(bounds.height - initialRect.height, initialRect.y + (point.y - startY))),
      };
    }

    if (mode.startsWith('resize')) {
      let left = initialRect.x;
      let top = initialRect.y;
      let right = initialRect.x + initialRect.width;
      let bottom = initialRect.y + initialRect.height;

      if (mode.includes('w')) left = point.x;
      if (mode.includes('e')) right = point.x;
      if (mode.includes('n')) top = point.y;
      if (mode.includes('s')) bottom = point.y;

      left = Math.max(0, Math.min(left, bounds.width - MIN_CROP_SIZE));
      top = Math.max(0, Math.min(top, bounds.height - MIN_CROP_SIZE));
      right = Math.max(left + MIN_CROP_SIZE, Math.min(right, bounds.width));
      bottom = Math.max(top + MIN_CROP_SIZE, Math.min(bottom, bounds.height));

      next = {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
    }

    setCropRect(next);
  };

  const onCropPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!noteId || !pendingFile) return;
    setUploading(true);
    try {
      const img = cropImageRef.current;
      let sourceCrop: CropRect | undefined;
      if (cropRect && img && sourceSize) {
        const bounds = img.getBoundingClientRect();
        const xScale = sourceSize.width / bounds.width;
        const yScale = sourceSize.height / bounds.height;
        sourceCrop = {
          x: cropRect.x * xScale,
          y: cropRect.y * yScale,
          width: cropRect.width * xScale,
          height: cropRect.height * yScale,
        };
      }

      const processed = await renderProcessedFile(pendingFile, sourceCrop);
      await noteAttachmentAPI.upload(noteId, processed, '', setUploadProgress);
      await loadAttachments();
      clearPendingSelection();
    } catch (error) {
      const response =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number; data?: { detail?: string } } }).response
          : undefined;
      const backendDetail = response?.data?.detail;
      const message = response?.status === 503
        ? (backendDetail ?? 'Image processing backend is unavailable on the server. Please install Pillow and restart backend.')
        : (backendDetail ?? 'Upload failed. Please try again.');
      setUploadError(message);
      console.error('Error uploading note attachment:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetCrop = (): void => {
    const img = cropImageRef.current;
    if (!img) return;
    const bounds = img.getBoundingClientRect();
    setCropRect({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
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
            <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) openCropDialog(file);
            }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) openCropDialog(file);
            }} />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => cameraInputRef.current?.click()}>Foto aufnehmen</Button>
              <Button variant="outlined" onClick={() => galleryInputRef.current?.click()}>Aus Galerie wählen</Button>
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
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', backgroundColor: '#111' }}>{selectedImage && <img src={selectedImage} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} alt="Attachment preview" />}</DialogContent>
        <DialogActions><Button onClick={() => setSelectedImage(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingFile)} onClose={clearPendingSelection} maxWidth="md" fullWidth>
        <DialogTitle>Crop</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>Draw, move and resize the crop rectangle. The outside area is dimmed.</Typography>
          {uploadError && <Alert severity="error" sx={{ mb: 1 }}>{uploadError}</Alert>}
          <Box
            data-testid="crop-stage"
            sx={{ position: 'relative', width: '100%', maxHeight: 420, overflow: 'auto', userSelect: 'none' }}
            onPointerMove={onCropPointerMove}
            onPointerUp={onCropPointerUp}
            onPointerCancel={onCropPointerUp}
            onPointerDown={(event) => onCropPointerDown(event, 'draw')}
          >
            {pendingPreviewUrl && (
              <img
                ref={cropImageRef}
                src={pendingPreviewUrl}
                alt="Crop source"
                style={{ width: '100%', display: 'block' }}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
                  const bounds = img.getBoundingClientRect();
                  setCropRect({
                    x: 0,
                    y: 0,
                    width: bounds.width,
                    height: bounds.height,
                  });
                }}
              />
            )}
            {cropRect && (
              <>
                <Box sx={{ position: 'absolute', left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', border: '2px solid #fff', cursor: 'move' }} onPointerDown={(event) => { event.stopPropagation(); onCropPointerDown(event, 'move'); }} />
                {([
                  { key: 'nw', x: cropRect.x, y: cropRect.y, mode: 'resize-nw', cursor: 'nwse-resize' },
                  { key: 'ne', x: cropRect.x + cropRect.width, y: cropRect.y, mode: 'resize-ne', cursor: 'nesw-resize' },
                  { key: 'sw', x: cropRect.x, y: cropRect.y + cropRect.height, mode: 'resize-sw', cursor: 'nesw-resize' },
                  { key: 'se', x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height, mode: 'resize-se', cursor: 'nwse-resize' },
                ] as const).map((handle) => (
                  <Box
                    key={handle.key}
                    data-testid={`crop-handle-${handle.key}`}
                    sx={{ position: 'absolute', left: handle.x - 7, top: handle.y - 7, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', backgroundColor: 'primary.main', cursor: handle.cursor }}
                    onPointerDown={(event) => { event.stopPropagation(); onCropPointerDown(event, handle.mode); }}
                  />
                ))}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearPendingSelection}>Cancel</Button>
          <Button onClick={resetCrop}>Reset</Button>
          <Button onClick={() => void handleUpload()} disabled={uploading || !pendingFile} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
