import AuthGuard from '@/components/AuthGuard';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="partner">{children}</AuthGuard>;
}
