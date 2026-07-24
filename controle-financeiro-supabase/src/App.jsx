import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import { C } from "./lib/constants";
import { loadAll } from "./lib/data";
import { useFonts, useThemeStyles, useTheme } from "./hooks";
import { Login, SetNewPassword } from "./components/domain";
import { LoadingSkeleton } from "./components/primitives";
import { MemberApp, AdminApp } from "./screens";
import { ToastProvider } from "./components/Toast";



/* ---------------------------------- ROOT ---------------------------------- */


export default function App() {
  useFonts();
  useThemeStyles();
  const [theme, toggleTheme] = useTheme();
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const refresh = useCallback(async () => {
    const scrollY = window.scrollY;
    try {
      const d = await loadAll();
      setData(d);
      setProfile((prev) => (prev ? d.profiles.find((p) => p.id === prev.id) || prev : prev));
      setError("");
    } catch (e) {
      console.error("Falha ao carregar dados:", e);
      setError("Não foi possível carregar os dados. Verifique sua conexão e tente novamente.");
    }
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setAuthUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) { setProfile(null); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      setProfile(p || null);
      await refresh();
    })();
  }, [authUser, refresh]);

  useEffect(() => {
    if (!authUser) return;
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(interval);
    };
  }, [authUser, refresh]);

  if (authUser === undefined) return <LoadingSkeleton />;
  if (passwordRecovery) return <SetNewPassword onDone={() => setPasswordRecovery(false)} theme={theme} onToggleTheme={toggleTheme} />;
  if (!authUser) return <Login onLogin={(u) => { try { localStorage.setItem("tab-member", "overview"); localStorage.setItem("tab-admin", "overview"); } catch {} setAuthUser(u); }} theme={theme} onToggleTheme={toggleTheme} />;
  if (!profile || !data) return error ? <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: C.bg, color: C.rose }}>{error}</div> : <LoadingSkeleton />;

  const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ background: C.bg }}>
        {error && <div className="text-center text-xs py-1.5" style={{ background: "rgba(221,124,134,0.15)", color: C.rose }}>{error}</div>}
        {profile.role === "admin" ? (
          <AdminApp profile={profile} data={data} refresh={refresh} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
        ) : (
          <MemberApp profile={profile} data={data} refresh={refresh} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
        )}
      </div>
    </ToastProvider>
  );
}
