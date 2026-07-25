import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../lib/useSettings";
import { api, ApiError } from "../lib/api";
import type { BookingSearchResult } from "../lib/types";

type Mode = "code" | "name";

export default function Home() {
  const { settings } = useSettings();
  const eventName = settings.eventName;
  const [mode, setMode] = useState<Mode>("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<BookingSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/b/${encodeURIComponent(trimmed)}`);
  }

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setSearchError("Type at least 2 letters of your name.");
      setResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const found = await api.get<BookingSearchResult[]>(`/bookings/search?name=${encodeURIComponent(trimmed)}`);
      setResults(found);
      if (found.length === 0) {
        setSearchError("No booking found under that name. Double-check the spelling, or use your code instead.");
      }
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : "Something went wrong searching for your booking.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setResults(null);
    setSearchError(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-soft to-cream">
      <div className="flex h-16 items-center justify-center border-b border-hairline bg-white/95">
        <span className="font-serif text-[15px] uppercase tracking-[0.3em] text-gold">{eventName}</span>
      </div>
      <main className="grid place-items-center px-5 py-16">
        <div className="animate-nox-up w-full max-w-[470px]">
          <div className="rounded-[20px] border border-hairline bg-card p-10 text-center shadow-[0_24px_60px_rgba(31,45,35,0.08)]">
            <div className="mx-auto mb-6 h-px w-13 bg-[#dccfa4]" />
            <h1 className="mb-2.5 font-serif text-[40px] font-semibold leading-[1.1] tracking-tight">
              Welcome to
              <br />
              {eventName}
            </h1>
            <p className="mb-6 text-[15px] leading-relaxed text-muted">
              Find your booking with the code from your invitation, or search by your name.
            </p>

            <div className="mb-6 flex justify-center gap-1 rounded-xl border border-hairline-soft bg-cream-soft p-1">
              <button
                type="button"
                onClick={() => switchMode("code")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium tracking-wide transition-colors ${
                  mode === "code" ? "bg-white text-forest shadow-[0_1px_2px_rgba(31,29,26,0.08)]" : "text-muted"
                }`}
              >
                I have a code
              </button>
              <button
                type="button"
                onClick={() => switchMode("name")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium tracking-wide transition-colors ${
                  mode === "name" ? "bg-white text-forest shadow-[0_1px_2px_rgba(31,29,26,0.08)]" : "text-muted"
                }`}
              >
                Search by name
              </button>
            </div>

            {mode === "code" ? (
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3.5">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="DNR-••••"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-[15px] text-center font-mono text-[19px] uppercase tracking-[0.16em] text-ink outline-none focus:border-forest focus:bg-white focus:shadow-[0_0_0_3px_var(--color-forest-ring)]"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-forest px-4 py-[15px] text-base font-medium tracking-wide text-white transition-colors hover:bg-forest-hover"
                >
                  Find my booking
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-3.5">
                <form onSubmit={handleNameSubmit} className="flex flex-col gap-3.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    autoCapitalize="words"
                    autoCorrect="off"
                    className="w-full rounded-xl border border-line bg-paper px-4 py-[15px] text-center text-[17px] text-ink outline-none focus:border-forest focus:bg-white focus:shadow-[0_0_0_3px_var(--color-forest-ring)]"
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="w-full rounded-xl bg-forest px-4 py-[15px] text-base font-medium tracking-wide text-white transition-colors hover:bg-forest-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </form>

                {searchError && <p className="text-sm text-red">{searchError}</p>}

                {results && results.length > 0 && (
                  <div className="flex flex-col gap-2 text-left">
                    {results.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => navigate(`/b/${encodeURIComponent(r.code)}`)}
                        className="flex items-center justify-between rounded-xl border border-hairline-soft bg-cream-soft px-4 py-3 text-left transition-colors hover:border-forest-tint-border hover:bg-forest-tint"
                      >
                        <span className="font-serif text-[17px] font-semibold text-ink">{r.guestName}</span>
                        <span className="text-sm text-forest">View seats →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-5 text-[13px] leading-relaxed text-muted-soft">
              Scanning the QR code on your card opens this page with the code already filled in.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
