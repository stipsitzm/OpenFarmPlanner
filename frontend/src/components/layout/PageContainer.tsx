import type { ReactElement, ReactNode } from 'react';

type PageContainerVariant =
  | 'standardCenteredPage'
  | 'compactCenteredPage'
  | 'workspacePage'
  | 'standard'
  | 'wide'
  | 'workspace'
  | 'xwide'
  | 'full'
  | 'wideWorkspace'
  | 'compactCenteredTable';

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSNAME: Record<PageContainerVariant, string> = {
  // Recommended categories:
  // - standardCenteredPage: default readable centered page width
  // - compactCenteredPage: compact, centered pages (e.g. Suppliers)
  // - workspacePage: full workspace width for data-heavy pages (e.g. Planting Plans, Gantt)
  standardCenteredPage: 'content',
  workspacePage: 'content content--workspace-page',
  compactCenteredPage: 'content content--compact-centered-page',
  // Legacy aliases kept for compatibility with older pages.
  wideWorkspace: 'content content--workspace-page',
  compactCenteredTable: 'content content--compact-centered-page',
  standard: 'content',
  wide: 'content content--wide',
  workspace: 'content content--workspace',
  xwide: 'content content--xwide',
  full: 'content--full',
};

function PageContainer({
  children,
  variant = 'standard',
  className,
}: PageContainerProps): ReactElement {
  const containerClassName = className
    ? `${VARIANT_CLASSNAME[variant]} ${className}`
    : VARIANT_CLASSNAME[variant];

  return (
    <div className={containerClassName}>
      {children}
    </div>
  );
}

export default PageContainer;
