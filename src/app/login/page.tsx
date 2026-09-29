import { Banner } from "@/components/ui";
import { SubmitButton } from "@/components/controls";
import { signIn } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams;
  return (
    <main className="authPage">
      <form className="authCard loginForm" action={signIn}>
        <img className="loginLogo" src="/mieszko-logo.webp" alt="Polski Supermarket Mieszko" />
        <h1>Mieszko Office Operations</h1>
        <p>Enter your 6-digit PIN</p>
        <label className="field">
          <span className="srOnly">6-digit PIN</span>
          <input
            className="pinInput"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            placeholder="••••••"
            aria-label="6-digit PIN"
            autoFocus
            required
          />
        </label>
        <Banner notice={query.notice} error={query.error} />
        <SubmitButton className="button primary loginSubmit" idle="Sign In" pending="Signing in..." />
      </form>
    </main>
  );
}
