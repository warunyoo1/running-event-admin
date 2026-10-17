import { AdminShell } from "@/components/admin-shell";
import { AuthProvider } from "@/features/admin/auth-provider";
import { ScopeProvider } from "@/features/admin/scope-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ScopeProvider>
        <AdminShell>
          {children}
        </AdminShell>
      </ScopeProvider>
    </AuthProvider>
  );
}
