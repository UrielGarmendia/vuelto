export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-full bg-flat-2 motion-reduce:animate-none ${className}`}
    />
  );
}
