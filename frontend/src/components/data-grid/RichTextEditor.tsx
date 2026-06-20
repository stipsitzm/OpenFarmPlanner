import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import TitleIcon from '@mui/icons-material/Title';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { useTranslation } from '../../i18n';

export interface RichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  focusRequestId?: number;
  /** Whether to focus the editor after content is initialized. Default: true. Pass false for inline/form use. */
  autoFocus?: boolean;
}

const TOOLBAR_SX = {
  display: 'flex',
  gap: 0.5,
  p: 0.75,
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  flexWrap: 'wrap',
};

const EDITOR_WRAPPER_SX = {
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
  '&:focus-within': {
    borderColor: 'primary.main',
    outline: '1px solid',
    outlineColor: 'primary.main',
  },
  '& .ProseMirror': {
    minHeight: 260,
    p: 1.5,
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  '& .ProseMirror h1': { fontSize: '1.5rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror h2': { fontSize: '1.25rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror h3': { fontSize: '1.1rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror ul, & .ProseMirror ol': { pl: 3, my: 0.5 },
  '& .ProseMirror li': { mb: 0.25 },
  '& .ProseMirror blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    pl: 2,
    ml: 0,
    my: 1,
    color: 'text.secondary',
  },
  '& .ProseMirror code': {
    fontFamily: 'monospace',
    fontSize: '0.875em',
    backgroundColor: 'action.hover',
    px: 0.5,
    borderRadius: 0.5,
  },
  '& .ProseMirror pre': {
    backgroundColor: 'action.hover',
    borderRadius: 1,
    p: 1.5,
    my: 1,
    overflow: 'auto',
    '& code': { backgroundColor: 'transparent', p: 0 },
  },
  '& .ProseMirror a': { color: 'primary.main', textDecoration: 'underline' },
  '& .ProseMirror p': { my: 0.5 },
  '& .ProseMirror p:first-of-type': { mt: 0 },
};

export function RichTextEditor({ value, onChange, focusRequestId = 0, autoFocus = true }: RichTextEditorProps) {
  const { t } = useTranslation('common');
  const openMarker = useRef(-1);
  // Prevents the onUpdate callback from propagating onChange when we programmatically
  // load content via setContent (e.g. on init or when a new item is opened).
  const isSettingContentRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Markdown.configure({ html: false, tightLists: true, transformPastedText: true }),
    ],
    content: '',
    onUpdate({ editor: e }) {
      if (e.isDestroyed || isSettingContentRef.current) return;
      onChange((e.storage as unknown as Record<string, { getMarkdown(): string }>).markdown.getMarkdown());
    },
  });

  // Re-initialize content when the editor first becomes ready or the caller
  // signals a new item was opened (focusRequestId incremented).
  useEffect(() => {
    if (!editor || editor.isDestroyed || focusRequestId === openMarker.current) return;
    openMarker.current = focusRequestId;
    isSettingContentRef.current = true;
    editor.commands.setContent(value);
    isSettingContentRef.current = false;
    if (autoFocus) {
      editor.commands.focus('end');
    }
  }, [editor, focusRequestId, value, autoFocus]);

  const handleSetLink = (): void => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('notesDrawer.toolbar.linkPrompt'), previous ?? '');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    }
  };

  return (
    <Box sx={EDITOR_WRAPPER_SX}>
      <Box sx={TOOLBAR_SX} role="toolbar" aria-label={t('notesDrawer.toolbar.ariaLabel')}>
        <Tooltip title={t('notesDrawer.toolbar.boldTooltip')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
            aria-label={t('notesDrawer.toolbar.bold')}
            aria-pressed={editor?.isActive('bold') ?? false}
          >
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.toolbar.italicTooltip')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
            aria-label={t('notesDrawer.toolbar.italic')}
            aria-pressed={editor?.isActive('italic') ?? false}
          >
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.toolbar.code')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleCode().run(); }}
            aria-label={t('notesDrawer.toolbar.code')}
            aria-pressed={editor?.isActive('code') ?? false}
          >
            <CodeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title={t('notesDrawer.toolbar.heading')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 2 }).run(); }}
            aria-label={t('notesDrawer.toolbar.heading')}
            aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}
          >
            <TitleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.toolbar.bulletList')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }}
            aria-label={t('notesDrawer.toolbar.bulletList')}
            aria-pressed={editor?.isActive('bulletList') ?? false}
          >
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.toolbar.numberedList')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }}
            aria-label={t('notesDrawer.toolbar.numberedList')}
            aria-pressed={editor?.isActive('orderedList') ?? false}
          >
            <FormatListNumberedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title={t('notesDrawer.toolbar.link')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); handleSetLink(); }}
            aria-label={t('notesDrawer.toolbar.link')}
            aria-pressed={editor?.isActive('link') ?? false}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.toolbar.quote')}>
          <IconButton
            size="small"
            onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBlockquote().run(); }}
            aria-label={t('notesDrawer.toolbar.quote')}
            aria-pressed={editor?.isActive('blockquote') ?? false}
          >
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <EditorContent editor={editor} />
    </Box>
  );
}
