export default function STLSplitterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  );
}
