import { SignInPanel } from '@/components/auth-panel';

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <SignInPanel mode="register" />
    </main>
  );
}
