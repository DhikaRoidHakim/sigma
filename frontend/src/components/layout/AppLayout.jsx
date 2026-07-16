import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, DoorOpen, LogOut, Menu, X, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard Aset", icon: LayoutDashboard, perms: ["assets.view"] },
  { to: "/offices", label: "Kantor", icon: Building2, perms: ["assets.view"] },
  { to: "/rooms", label: "Ruangan", icon: DoorOpen, perms: ["assets.view"] },
  { to: "/users", label: "Manajemen User", icon: Users, perms: ["users.manage"] },
  { to: "/roles", label: "Role & Izin", icon: ShieldCheck, perms: ["roles.manage"] },
];

export const AppLayout = () => {
  const { user, logout, hasPerm } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navContent = (
    <>
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-white/10">
        <img src="/logo.png" alt="Logo SIGMA" className="w-8 h-8 rounded-full shrink-0" />
        <div>
          <p className="text-white font-semibold text-lg tracking-tight leading-none">SIGMA</p>
          <p className="text-white/50 text-[10px] tracking-wider mt-0.5">MANAJEMEN ASET</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1" aria-label="Navigasi utama">
        {navItems.filter(({ perms }) => hasPerm(...perms)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setMobileOpen(false)}
            data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white border-l-2 border-[#92BA3C]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#92BA3C] flex items-center justify-center text-[#01567A] font-semibold text-sm shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/50 text-xs truncate">{user?.role_name || user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          data-testid="logout-button"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-white/60 hover:text-white hover:bg-white/5 mt-1"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Keluar
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#01567A] z-40">
        {navContent}
      </aside>

      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-[#01567A]">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo SIGMA" className="w-7 h-7 rounded-full" />
          <span className="text-white font-semibold tracking-tight">SIGMA</span>
        </div>
        <button
          aria-label="Buka menu"
          data-testid="mobile-menu-button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-white p-2"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-30 bg-[#01567A] flex flex-col">
          {navContent}
        </div>
      )}

      <main className="lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
