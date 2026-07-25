import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";

export default function AdminLogin({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-cream-soft to-cream px-6">
      <div className="animate-nox-up w-full max-w-xs">
        <div className="rounded-[20px] border border-hairline bg-card p-9 text-center shadow-[0_24px_60px_rgba(31,45,35,0.08)]">
          <div className="mx-auto mb-5 h-px w-13 bg-[#dccfa4]" />
          <h1 className="mb-1 font-serif text-[28px] font-semibold leading-tight text-ink">DinnerSeats</h1>
          <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-gold">Admin</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-center text-ink outline-none focus:border-forest focus:bg-white focus:shadow-[0_0_0_3px_var(--color-forest-ring)]"
            />
            {error && <p className="text-sm text-red">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-forest px-4 py-3 font-medium tracking-wide text-white transition-colors hover:bg-forest-hover disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
