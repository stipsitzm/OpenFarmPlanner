import type { ReactElement, ReactNode } from 'react';

type PageContainerVariant =
  | 'standard'
  | 'wide'
  | 'workspace'
  | 'xwide'
  | 'full'
  | 'compactCenteredTable'
  | 'wideWorkspaceTable';

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSNAME: Record<PageContainerVariant, string> = {
  standard: 'content',
  wide: 'content content--wide',
  workspace: 'content content--workspace',
  xwide: 'content content--xwide',
  full: 'content--full',
  compactCenteredTable: 'content content--compact-centered-table',
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
