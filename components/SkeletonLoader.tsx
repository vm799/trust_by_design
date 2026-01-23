import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />
);

export const MetricCardSkeleton: React.FC = () => (
  <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl">
    <Skeleton className="h-3 w-16 mb-3" />
    <Skeleton className="h-8 w-12" />
  </div>
);

export const JobCardSkeleton: React.FC = () => (
  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl space-y-4">
    <div className="flex justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-20" />
    </div>
    <Skeleton className="h-4 w-48" />
    <div className="flex gap-2">
      <Skeleton className="h-6 w-6 rounded-md" />
      <Skeleton className="h-6 w-6 rounded-md" />
      <Skeleton className="h-6 w-6 rounded-md" />
    </div>
  </div>
);

export const TableRowSkeleton: React.FC = () => (
  <tr>
    <td className="px-8 py-6"><Skeleton className="h-5 w-40" /></td>
    <td className="px-8 py-6"><Skeleton className="h-5 w-24" /></td>
    <td className="px-8 py-6"><Skeleton className="h-6 w-20 rounded-full" /></td>
    <td className="px-8 py-6"><div className="flex gap-1"><Skeleton className="h-6 w-6 rounded-md" /><Skeleton className="h-6 w-6 rounded-md" /></div></td>
    <td className="px-8 py-6 text-right"><Skeleton className="h-6 w-24 rounded-full ml-auto" /></td>
  </tr>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header skeleton */}
    <div className="flex justify-between items-end">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-12 w-40 rounded-2xl" />
    </div>

    {/* Metrics skeleton */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>

    {/* Table skeleton */}
    <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden">
      <div className="px-8 py-6 border-b border-white/5">
        <Skeleton className="h-4 w-32" />
      </div>
      <table className="w-full">
        <tbody>
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </tbody>
      </table>
    </div>
  </div>
);
