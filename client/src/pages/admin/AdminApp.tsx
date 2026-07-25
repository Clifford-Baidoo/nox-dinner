import { NavLink, Route, Routes } from "react-router-dom";
import { useAdminAuth } from "../../lib/useAdminAuth";
import AdminLogin from "./AdminLogin";
import AdminTables from "./AdminTables";
import AdminBookings from "./AdminBookings";
import AdminSeatMap from "./AdminSeatMap";
import AdminPrint from "./AdminPrint";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3.5 py-2 text-sm ${isActive ? "bg-forest-tint font-medium text-forest" : "font-normal text-muted hover:bg-cream-soft"}`;

export default function AdminApp() {
  const auth = useAdminAuth();

  if (auth.authenticated === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }

  if (!auth.authenticated) {
    return <AdminLogin onLogin={auth.login} />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-hairline bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 px-5 py-0" style={{ height: 70 }}>
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl font-semibold tracking-wide text-forest">DinnerSeats</span>
            <span className="pb-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-soft">Admin</span>
          </div>
          <nav className="ml-2 flex flex-wrap gap-1">
            <NavLink to="/admin/bookings" className={navClass}>
              Bookings
            </NavLink>
            <NavLink to="/admin/tables" className={navClass}>
              Layout
            </NavLink>
            <NavLink to="/admin/seatmap" className={navClass}>
              Live Map
            </NavLink>
            <NavLink to="/admin/print" className={navClass}>
              Print QRs
            </NavLink>
          </nav>
          <div className="flex-1" />
          <button
            onClick={() => auth.logout()}
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm text-ink-soft hover:border-line hover:bg-cream"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route index element={<AdminBookings />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="tables" element={<AdminTables />} />
          <Route path="seatmap" element={<AdminSeatMap />} />
          <Route path="print" element={<AdminPrint />} />
        </Routes>
      </main>
    </div>
  );
}
