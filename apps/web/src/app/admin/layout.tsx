import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin · Visagismo',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-100/60 text-ink-900">
      {children}
    </div>
  );
}
