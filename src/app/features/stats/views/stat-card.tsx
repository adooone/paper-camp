import { Card } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export interface StatCardProps {
  title: string;
  children: ReactNode;
}

export const StatCard = ({ title, children }: StatCardProps) => (
  <div className="flex-[1_1_260px] max-w-[360px] max-[480px]:flex-[1_1_100%] max-[480px]:max-w-none">
    <Card size="small" texture="kraft" className="h-full">
      <div className="flex flex-col gap-3">
        <span className="font-handwritten text-xs font-semibold opacity-[0.55]">{title}</span>
        {children}
      </div>
    </Card>
  </div>
);

export interface StatRowProps {
  label: string;
  value: ReactNode;
}

export const StatRow = ({ label, value }: StatRowProps) => (
  <div className="flex items-center justify-between gap-2">
    <span className="opacity-70">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);
