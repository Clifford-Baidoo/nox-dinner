import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useSettings } from "../../lib/useSettings";

interface PrintSlip {
  code: string;
  guestName: string;
  seatsAllowed: number;
  qr: string;
}

export default function AdminPrint() {
  const [slips, setSlips] = useState<PrintSlip[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    api.get<PrintSlip[]>("/admin/print-batch").then(setSlips);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Print QR cards</h1>
          <p className="mt-1 text-sm text-muted">{slips.length} pending bookings · cut along the dashed line</p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-hover"
        >
          Print all cards
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {slips.map((s) => (
          <div
            key={s.code}
            className="flex flex-col items-center gap-1 rounded-2xl border border-hairline bg-card p-5 text-center shadow-[0_1px_2px_rgba(31,29,26,0.03)] print:border-black print:bg-white print:shadow-none"
          >
            <div className="mb-3 font-serif text-[13px] uppercase tracking-[0.22em] text-gold print:text-black">
              {settings.eventName}
            </div>
            <img src={s.qr} alt={s.code} className="mb-3 h-32 w-32 rounded-lg border border-hairline-soft bg-white p-2" />
            <p className="font-mono text-[15px] tracking-wide text-forest print:text-black">{s.code}</p>
            <p className="font-serif text-lg font-semibold text-ink">{s.guestName}</p>
            <p className="text-xs text-muted">{s.seatsAllowed} seat(s)</p>
            <div className="mt-3 w-full border-t border-dashed border-hairline-soft pt-3 text-[11px] text-muted-soft">
              Scan to choose your seats
            </div>
          </div>
        ))}
      </div>
      {slips.length === 0 && <p className="text-sm text-muted">No pending bookings to print.</p>}
    </div>
  );
}
