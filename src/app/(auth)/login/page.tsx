import { redirect } from 'next/navigation';

export default function LoginPage() {
  // Redirect to dashboard as login is now handled automatically via anonymous auth
  redirect('/dashboard');
}
