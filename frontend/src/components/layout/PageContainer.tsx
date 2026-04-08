import type { ReactElement, ReactNode } from 'react';

type PageContainerVariant = 'standard' | 'wide' | 'full';

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

const VARIANT_CLASSNAME: Record<PageContainerVariant, string> = {
  standard: 'content',
  wide: 'content content--wide',
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
