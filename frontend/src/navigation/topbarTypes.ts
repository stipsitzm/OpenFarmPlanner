/**
 * Shared types for the topbar action contract between the root layout and pages.
 *
 * Pages publish contextual actions into the persistent topbar via the outlet
 * context; the root layout renders them. Kept in a standalone module so pages
 * and hooks do not need to import the (heavy) root layout component.
 */

export interface TopbarContextAction {
  id: string;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  shortcutHint?: string;
  active?: boolean;
  hidden?: boolean;
  reserveSpace?: boolean;
  groupId?: string;
  tooltip?: string;
  menuActions?: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean }>;
}

export interface RootLayoutOutletContext {
  setTopbarContextActions: (actions: TopbarContextAction[]) => void;
  setTopbarTitleActions: (actions: TopbarContextAction[]) => void;
}
