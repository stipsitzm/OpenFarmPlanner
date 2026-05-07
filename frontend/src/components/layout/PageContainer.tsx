import type { ReactElement, ReactNode } from 'react';

type PageContainerVariant = 'narrow' | 'default' | 'wide' | 'full' | 'standard' | 'workspace' | 'xwide';

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSNAME: Record<PageContainerVariant, string> = {
  narrow: 'content content--narrow',
  default: 'content content--default',
  standard: 'content',
  wide: 'content content--wide',
  workspace: 'content content--wide',
  xwide: 'content content--xwide',
  full: 'content--full',
};

function PageContainer({
  children,
  variant = 'default',
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
