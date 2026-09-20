import { LoginForm } from "@/components/login-form";

// Nonce-based CSP is applied per request, which requires dynamic rendering.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
