import { StatusBarCore, type StatusBarCoreProps } from '@/app/components/shell/status-bar-core';
import type { DerivedCheckStatuses } from '@/app/utils/check-status';
import type { CheckStatus } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';

const stampsRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.375rem',
  marginBottom: '0.5rem',
};

const CHECK_VARIANT: Record<CheckStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

export interface ShipPanelProps extends StatusBarCoreProps, DerivedCheckStatuses {}

export const ShipPanel = ({
  qualityStatus,
  testStatus,
  consistencyStatus,
  ...statusBarProps
}: ShipPanelProps) => (
  <div>
    <div style={stampsRowStyle}>
      <Stamp size="small" variant={CHECK_VARIANT[qualityStatus]}>
        Quality
      </Stamp>
      <Stamp size="small" variant={CHECK_VARIANT[testStatus]}>
        Tests
      </Stamp>
      <Stamp size="small" variant={CHECK_VARIANT[consistencyStatus]}>
        Consistency
      </Stamp>
    </div>
    <StatusBarCore {...statusBarProps} />
  </div>
);
