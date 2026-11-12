// Okostje med nalaganjem table.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="mx-auto h-8 w-56 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
