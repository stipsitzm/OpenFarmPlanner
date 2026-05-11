import type { ReactElement, ReactNode } from 'react';

type PageContainerVariant =
  | 'standardCenteredPage'
  | 'wideWorkspace'
  | 'compactCenteredTable'
  | 'standard'
  | 'wide'
  | 'workspace'
  | 'xwide'
  | 'full'
  | 'wideWorkspaceTable';

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSNAME: Record<PageContainerVariant, string> = {
  // Recommended categories:
  // - standardCenteredPage: default readable centered page width
  // - compactCenteredTable: compact, centered table pages (e.g. Suppliers)
  // - wideWorkspace: full workspace width for data-heavy pages (e.g. Planting Plans, Gantt)
  standardCenteredPage: 'content',
  wideWorkspace: 'content content--workspace-table',
  compactCenteredTable: 'content content--compact-centered-table',
  standard: 'content',
  wide: 'content content--wide',
  workspace: 'content content--workspace',
  xwide: 'content content--xwide',
  full: 'content--full',
  wideWorkspaceTable: 'content content--workspace-table',
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
