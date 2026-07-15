import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Hexagon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/services/api";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F8FAFC]">
      <div className="hidden lg:flex flex-col justify-between bg-[#01567A] p-12">
        <div className="flex items-center gap-3">
          <Hexagon size={32} className="text-[#92BA3C]" strokeWidth={2} />
          <div>
            <p className="text-white font-semibold text-xl tracking-tight leading-none">SIGMA</p>
            <p className="text-white/50 text-[11px] tracking-widest mt-1">SISTEM INFORMASI MANAJEMEN ASET</p>
          </div>
        </div>
        <div>
          <h1 className="text-white text-4xl font-semibold tracking-tight leading-tight max-w-md">
            Lacak posisi dan riwayat perpindahan aset secara menyeluruh.
          </h1>
          <p className="text-white/60 mt-4 max-w-md">
            Kelola mutasi aset antar kantor dan ruangan dengan histori lengkap yang tidak pernah hilang.
          </p>
        </div>
        <p className="text-white/40 text-xs">© 2026 SIGMA · Enterprise Asset Management</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Hexagon size={26} className="text-[#92BA3C]" />
            <span className="font-semibold text-lg text-[#01567A]">SIGMA</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1F2937]">Masuk ke SIGMA</h2>
          <p className="text-sm text-[#6B7280] mt-1.5">Gunakan akun Anda untuk mengakses sistem.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                data-testid="login-email-input"
                placeholder="admin@sigma.co.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-[#E5E7EB]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                data-testid="login-password-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-[#E5E7EB]"
              />
            </div>
            {error && (
              <p data-testid="login-error" className="text-sm text-[#DC2626] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full bg-[#01567A] hover:bg-[#014462] text-white"
            >
              {loading && <Loader2 size={16} className="animate-spin mr-2" />}
              Masuk
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
