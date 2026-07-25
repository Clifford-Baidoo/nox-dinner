import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../lib/useSettings";

export default function Home() {
  const { settings } = useSettings();
  const eventName = settings.eventName;
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/b/${encodeURIComponent(trimmed)}`);
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
            <p className="mb-7 text-[15px] leading-relaxed text-muted">
              Enter the booking code from your invitation to choose where you'll sit.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
            <p className="mt-5 text-[13px] leading-relaxed text-muted-soft">
              Scanning the QR code on your card opens this page with the code already filled in.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
