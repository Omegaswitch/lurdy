import { iconPaths, type IconName } from '@lurdy/shared';
import type { SVGProps } from 'react';

const P = iconPaths;
export type { IconName };

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'warn' | 'ok' | 'info'; children: React.ReactNode }) {
  const icon = kind === 'error' || kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info';
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}
