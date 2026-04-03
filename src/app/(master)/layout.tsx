import AuthGuard from '@/components/AuthGuard';

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="master">{children}</AuthGuard>;
}
