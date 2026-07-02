export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
