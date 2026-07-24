import React, { useState, useEffect, useRef } from "react";
import { Plus, PieChart as PieIcon, X, ChevronRight, Target, Sun, Moon, Paperclip, Zap, Calendar, Camera, History, BellRing } from "lucide-react";
import { C, MONTHS_FULL_PT, WEEKDAYS_PT, HERO_GRADIENT } from "../lib/constants";
import { brl, firstName, sortByName, upcomingBills, formatMoneyFromCents, formatDateBR, daysInMonth, pad2 } from "../lib/domain";
import { useCountUp } from "../hooks";

export function UpcomingBillsPanel({ cards, expenses }) {
  const bills = upcomingBills(cards, expenses);
  if (bills.length === 0) return null;
  return (
    <Panel className="mb-4">
      <h4 className="text-xs font-medium mb-3 tracking-wide uppercase flex items-center gap-1.5" style={{ color: C.muted }}>
        <BellRing size={12} color={C.gold} /> Próximos vencimentos
      </h4>
      <div className="space-y-2.5">
        {bills.map(({ card, daysUntilDue, total }) => (
          <div key={card.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate" style={{ color: C.text }}>{card.name}</span>
              <Chip tone={daysUntilDue <= 2 ? "rose" : "amber"}>{daysUntilDue === 0 ? "vence hoje" : `${daysUntilDue}d`}</Chip>
            </div>
            <Amount value={total} size="text-sm" tone="rose" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// Tela de carregamento inicial, no lugar de um texto solto "Carregando...".
// Imita o formato real da tela (topo + card grande + linhas de lista) pra dar
// uma ideia de "o conteúdo já tá quase aparecendo" em vez de tela em branco.
export function LoadingSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 90, height: 14 }} />
        </div>
        <div className="skeleton mb-4" style={{ height: 118, borderRadius: 24 }} />
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 62 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroPanel({ label, value, sub }) {
  const animated = useCountUp(value);
  return (
    <div className="relative p-6 mb-4" style={{ background: C.goldDeep, borderRadius: 6, boxShadow: C.shadow }}>
      {/* dobra de canto, como a página de um livro-caixa */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 22, height: 22, background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.28) 50%)`, borderRadius: "0 6px 0 0" }} />
      <span className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(244,241,233,0.6)" }}>{label}</span>
      <div className="mt-2">
        <span className="text-4xl font-bold" style={{ color: "#F4F1E9", fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{brl(animated)}</span>
      </div>
      <div style={{ height: 1, background: "rgba(244,241,233,0.18)", marginTop: 14, marginBottom: sub ? 8 : 0 }} />
      {sub && <div className="text-xs" style={{ color: "rgba(244,241,233,0.6)" }}>{sub}</div>}
    </div>
  );
}

export function Switch({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="relative shrink-0 transition-all" style={{ width: 40, height: 23, borderRadius: 999, background: checked ? C.gold : C.bgSoft, border: `1px solid ${checked ? C.gold : C.border}` }}>
      <span className="absolute rounded-full transition-all" style={{ width: 17, height: 17, background: "#fff", top: 2, left: checked ? 20 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
  );
}
export function IconField({ icon, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }}>{icon}</span>
      <TextInput {...props} style={{ paddingLeft: 26, ...(props.style || {}) }} />
    </div>
  );
}
export function CurrencyInput({ value, onChange, placeholder = "0,00", style, autoFocus }) {
  const [display, setDisplay] = useState(() => {
    const cents = value !== "" && value != null && !isNaN(value) ? Math.round(parseFloat(value) * 100) : 0;
    return cents ? formatMoneyFromCents(cents) : "";
  });
  useEffect(() => {
    const cents = value !== "" && value != null && !isNaN(value) ? Math.round(parseFloat(value) * 100) : 0;
    setDisplay(cents ? formatMoneyFromCents(cents) : "");
  }, [value]);
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setDisplay(""); onChange(""); return; }
    const cents = parseInt(raw, 10);
    setDisplay(formatMoneyFromCents(cents));
    onChange(String(cents / 100));
  };
  return <TextInput inputMode="numeric" value={display} onChange={handleChange} placeholder={placeholder} style={style} autoFocus={autoFocus} />;
}
export function CurrencyIconField({ icon, value, onChange, style }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }}>{icon}</span>
      <CurrencyInput value={value} onChange={onChange} style={{ paddingLeft: 26, ...(style || {}) }} />
    </div>
  );
}

/* ---------------------------------- UI atoms ---------------------------------- */

export function Panel({ children, style, className = "" }) {
  return <div className={`rounded-lg p-5 ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: C.shadow, ...style }}>{children}</div>;
}
export function Btn({ children, onClick, variant = "primary", type = "button", full, disabled }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50";
  const styles = {
    primary: { background: C.gold, color: "var(--gold-contrast)" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.rose, border: `1px solid rgba(221,124,134,0.35)` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${full ? "w-full" : ""}`} style={styles[variant]}>{children}</button>;
}
export function Field({ label, children }) {
  return <label className="block mb-3.5"><span className="block text-xs mb-1.5 tracking-wide" style={{ color: C.muted }}>{label}</span>{children}</label>;
}
export const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };
export const inputClass = "w-full rounded-lg px-3 py-2.5 text-base outline-none app-input";
export function TextInput(props) { return <input {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} />; }
export function Select(props) { return <select {...props} className={inputClass} style={inputStyle} />; }
export function Modal({ title, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 150); // espera a animação de saída antes de desmontar de verdade
  };
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(6,8,20,0.75)", animation: closing ? "modal-backdrop-in 0.15s ease-in reverse both" : "modal-backdrop-in 0.18s ease-out both" }}
      onClick={close}>
      <div className={closing ? "animate-modal-out" : "animate-modal-panel"} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 448, borderRadius: 16, padding: 20, maxHeight: "85vh", overflowY: "auto", background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
          <button onClick={close} aria-label="Fechar"><X size={18} color={C.muted} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DateInput({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const openPicker = () => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
  };
  const changeMonth = (delta) => {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(viewYear, viewMonth - 1);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: prevMonthDays - firstWeekday + 1 + i, muted: true });
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, muted: false });
  let nextDay = 1;
  while (cells.length % 7 !== 0) cells.push({ day: nextDay++, muted: true });

  const keyFor = (day) => `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
  const selectDay = (day) => { onChange(keyFor(day)); setOpen(false); };
  const today = new Date();
  const isToday = (day) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  return (
    <>
      <button type="button" onClick={openPicker} className={`${inputClass} flex items-center justify-between`} style={inputStyle}>
        <span style={{ color: value ? C.text : C.muted }}>{value ? formatDateBR(value) : (placeholder || "Selecionar data")}</span>
        <Calendar size={15} color={C.muted} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(6,8,20,0.75)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow, maxHeight: "94vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>Selecionar data</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} color={C.muted} /></button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => changeMonth(-1)}><ChevronRight size={16} color={C.muted} style={{ transform: "rotate(180deg)" }} /></button>
              <span className="text-sm font-medium capitalize" style={{ color: C.text }}>{MONTHS_FULL_PT[viewMonth]} de {viewYear}</span>
              <button type="button" onClick={() => changeMonth(1)}><ChevronRight size={16} color={C.muted} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS_PT.map((w, i) => <div key={i} className="text-center text-[10px]" style={{ color: C.muted }}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {cells.map((c, i) => {
                const selected = !c.muted && value === keyFor(c.day);
                return (
                  <button key={i} type="button" disabled={c.muted} onClick={() => selectDay(c.day)}
                    className="aspect-square rounded-lg text-xs flex items-center justify-center transition-all"
                    style={{
                      background: selected ? C.gold : "transparent",
                      color: c.muted ? C.border : selected ? "var(--gold-contrast)" : (isToday(c.day) ? C.gold : C.text),
                      border: isToday(c.day) && !selected ? `1px solid ${C.gold}` : "1px solid transparent",
                      cursor: c.muted ? "default" : "pointer",
                    }}>
                    {c.day}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ color: C.muted }}>Limpar</button>
              <button type="button" onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`); setOpen(false); }} style={{ color: C.gold }}>Hoje</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Desliza o conteúdo pra esquerda com o dedo e revela botões de ação atrás
// (editar/excluir) — só funciona por toque (não em mouse), então no desktop
// os botões continuam sendo os de sempre, sempre visíveis. `actions` é uma
// lista de { icon, label, onClick, background }.
export function SwipeActions({ children, actions }) {
  const ACTION_WIDTH = 64;
  const maxReveal = actions.length * ACTION_WIDTH;
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, baseX: 0 });
  const lockedAxisRef = useRef(null); // "x" | "y" | null — decide na primeira movimentação se é swipe ou scroll da página

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return; // no desktop os botões normais já resolvem
    startRef.current = { x: e.clientX, y: e.clientY, baseX: dragX };
    lockedAxisRef.current = null;
    draggingRef.current = true;
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!lockedAxisRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // ainda não deu pra saber a intenção
      lockedAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (lockedAxisRef.current !== "x") return; // é rolagem vertical da página, deixa passar
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = Math.min(0, Math.max(-maxReveal, startRef.current.baseX + dx));
    setDragX(next);
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (lockedAxisRef.current === "x") setDragX((x) => (x < -maxReveal / 2 ? -maxReveal : 0));
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 right-0 flex lg:hidden" style={{ width: maxReveal }}>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.onClick(); setDragX(0); }} aria-label={a.label}
            className="flex items-center justify-center h-full" style={{ width: ACTION_WIDTH, background: a.background }}>
            {a.icon}
          </button>
        ))}
      </div>
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        style={{ transform: `translateX(${dragX}px)`, transition: draggingRef.current ? "none" : "transform 0.2s ease-out", background: "var(--bg)", touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}

export function FileInput({ onFileSelected, accept, label, maxSizeMB = 10 }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const handleChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > maxSizeMB * 1024 * 1024) {
      setError(`Esse arquivo tem ${(f.size / (1024 * 1024)).toFixed(1)} MB — o máximo é ${maxSizeMB} MB.`);
      setFileName("");
      e.target.value = ""; // permite escolher o mesmo arquivo de novo depois de trocar
      return;
    }
    setError("");
    setFileName(f?.name || "");
    onFileSelected(f);
  };
  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
          <Paperclip size={13} /> {label || "Escolher arquivo"}
        </button>
        <span className="text-xs truncate" style={{ color: fileName ? C.text : C.muted, maxWidth: 160 }}>{fileName || "Nenhum arquivo escolhido"}</span>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      </div>
      {error && <p className="text-xs mt-1.5" style={{ color: C.rose }}>{error}</p>}
    </div>
  );
}

export function Amount({ value, size = "text-lg", tone, animate = false }) {
  const color = tone === "rose" ? C.rose : tone === "green" ? C.green : tone === "gold" ? C.gold : C.text;
  const animated = useCountUp(value); // hook sempre chamado (regra dos hooks); só usamos o valor se animate=true
  return <span className={size} style={{ fontFamily: "'IBM Plex Mono', monospace", color, fontVariantNumeric: "tabular-nums" }}>{brl(animate ? animated : value)}</span>;
}
export function ProgressBar({ pct, tone = "gold" }) {
  const color = tone === "rose" ? C.rose : tone === "green" ? C.green : C.gold;
  return <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: C.border }}><div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(Math.max(pct, pct > 0 ? 3 : 0), 100)}%`, background: color }} /></div>;
}
export function Chip({ tone = "muted", icon, children }) {
  const colors = { rose: C.rose, amber: C.amber, muted: C.muted, green: C.green, gold: C.gold };
  const color = colors[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}1F`, color }}>
      {icon}{children}
    </span>
  );
}
export function ScreenHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle}</p>}
    </div>
  );
}
export function EmptyState({ icon, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-9 px-4 gap-2.5" style={{ border: `1.5px dashed ${C.border}`, borderRadius: 4 }}>
      <div style={{ color: C.muted, opacity: 0.55 }}>{icon}</div>
      <p className="text-sm max-w-[240px]" style={{ color: C.muted }}>{text}</p>
      {action}
    </div>
  );
}

/* ---------------------------------- bottom navigation ---------------------------------- */

export function BottomNav({ tabs, tab, setTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ background: "var(--surface)", borderTop: `1px solid ${C.border}`, boxShadow: "0 -8px 24px rgba(0,0,0,0.12)" }}>
      <div className="max-w-3xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-1 py-2.5 transition-all">
              <div className="relative" style={{ color: active ? C.gold : C.muted }}>
                {t.icon}
                {t.badge && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full" style={{ background: C.rose }} />}
              </div>
              <span className="text-[10px] font-medium" style={{ color: active ? C.gold : C.muted }}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}

/* ---------------------------------- TOPBAR ---------------------------------- */

export function AvatarCropModal({ file, onCancel, onCropped }) {
  const FRAME = 230;
  const OUTPUT = 480;
  const [imgUrl, setImgUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = Math.max(FRAME / natural.w, FRAME / natural.h) || 1;
  const effectiveScale = baseScale * zoom;
  const dispW = natural.w * effectiveScale;
  const dispH = natural.h * effectiveScale;

  const clamp = (o) => {
    const maxX = Math.max((dispW - FRAME) / 2, 0);
    const maxY = Math.max((dispH - FRAME) / 2, 0);
    return { x: Math.min(Math.max(o.x, -maxX), maxX), y: Math.min(Math.max(o.y, -maxY), maxY) };
  };

  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY, origin: offset }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset(clamp({ x: dragRef.current.origin.x + (e.clientX - dragRef.current.x), y: dragRef.current.origin.y + (e.clientY - dragRef.current.y) }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const confirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const ratio = OUTPUT / FRAME;
      const drawW = dispW * ratio, drawH = dispH * ratio;
      const drawX = OUTPUT / 2 - drawW / 2 + offset.x * ratio;
      const drawY = OUTPUT / 2 - drawH / 2 + offset.y * ratio;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      canvas.toBlob((blob) => {
        onCropped(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    };
    img.src = imgUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(6,8,20,0.75)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow, maxHeight: "94vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>Ajustar foto</h3>
          <button onClick={onCancel}><X size={18} color={C.muted} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: C.muted }}>A foto de perfil precisa ser quadrada. Arraste pra posicionar e use o zoom pra ajustar.</p>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          className="relative mx-auto overflow-hidden rounded-2xl mb-4 select-none" style={{ width: FRAME, height: FRAME, background: C.bgSoft, touchAction: "none", cursor: "grab" }}>
          {imgUrl && (
            <img src={imgUrl} draggable={false} alt="" style={{
              position: "absolute", left: "50%", top: "50%", width: dispW, height: dispH,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`, pointerEvents: "none",
            }} />
          )}
        </div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs shrink-0" style={{ color: C.muted }}>Zoom</span>
          <input type="range" min="1" max="3" step="0.05" value={zoom}
            onChange={(e) => { setZoom(parseFloat(e.target.value)); setOffset((o) => clamp(o)); }} className="flex-1" />
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onCancel} full>Cancelar</Btn>
          <Btn onClick={confirm} full>Usar foto</Btn>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ profile, size = 32, editable, onUpload, uploading }) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const initial = firstName(profile?.name || "?").charAt(0).toUpperCase();

  const handleFileSelected = (file) => {
    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
      alert(`Essa foto tem ${(file.size / (1024 * 1024)).toFixed(1)} MB — o máximo é ${maxMB} MB. Tente uma foto menor.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (Math.abs(img.naturalWidth - img.naturalHeight) <= 2) onUpload(file);
      else setPendingFile(file);
    };
    img.src = url;
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={`Foto de ${profile?.name || "perfil"}`} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center font-bold"
          style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`, color: "var(--gold-contrast)", fontFamily: "'Manrope', sans-serif", fontSize: size * 0.42 }}>
          {initial}
        </div>
      )}
      {editable && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="absolute -right-0.5 -bottom-0.5 rounded-full flex items-center justify-center"
            style={{ width: Math.max(size * 0.42, 16), height: Math.max(size * 0.42, 16), background: C.gold, color: "var(--gold-contrast)", border: "2px solid var(--surface)" }}>
            <Camera size={Math.max(size * 0.22, 9)} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ""; }} />
        </>
      )}
      {pendingFile && (
        <AvatarCropModal file={pendingFile} onCancel={() => setPendingFile(null)}
          onCropped={(f) => { setPendingFile(null); onUpload(f); }} />
      )}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"} title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      className="w-8 h-8 rounded-full flex items-center justify-center transition-all" style={{ border: `1px solid ${C.border}` }}>
      {theme === "dark" ? <Sun size={14} color={C.gold} /> : <Moon size={14} color={C.gold} />}
    </button>
  );
}

export function PersonFilter({ profiles, selectedIds, onChange }) {
  const allSelected = selectedIds.length === 0;
  const toggle = (id) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      <button onClick={() => onChange([])}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: allSelected ? C.gold : "transparent", color: allSelected ? "var(--gold-contrast)" : C.muted, border: `1px solid ${allSelected ? C.gold : C.border}` }}>
        Todos
      </button>
      {sortByName(profiles).map((p) => {
        const active = selectedIds.includes(p.id);
        return (
          <button key={p.id} onClick={() => toggle(p.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: active ? C.gold : "transparent", color: active ? "var(--gold-contrast)" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
            {firstName(p.name)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- ADMIN: REPORTS ---------------------------------- */

export function ReportTabs({ view, setView, isAdmin }) {
  const items = [
    { id: "charts", label: "Gráficos", icon: <PieIcon size={15} /> },
    ...(isAdmin ? [{ id: "activity", label: "Atividade", icon: <History size={15} /> }] : []),
  ];
  if (items.length <= 1) return null; // nada pra alternar — não faz sentido mostrar um seletor de 1 opção só
  return (
    <div className="flex gap-2 mb-4">
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button key={it.id} onClick={() => setView(it.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: active ? C.gold : C.surface, color: active ? "var(--gold-contrast)" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
            {it.icon} {it.label}
          </button>
        );
      })}
    </div>
  );
}

// Some depois de rolar um pouco a tela; some de volta perto do topo. Fica do
// lado esquerdo pra não brigar com o botão flutuante de adicionar (direita).
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="animate-item-enter fixed z-40 w-11 h-11 rounded-full flex items-center justify-center left-[18px] bottom-[calc(78px+env(safe-area-inset-bottom,0px))] lg:bottom-6"
      style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}
      title="Voltar ao topo"
    >
      <ChevronRight size={18} color={C.gold} style={{ transform: "rotate(-90deg)" }} />
    </button>
  );
}

export function FloatingAddButton({ onAddExpense, onAddIncome }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed z-40 flex flex-col items-end gap-2.5 lg:hidden" style={{ right: 18, bottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>
      {open && (
        <>
          <button onClick={() => { setOpen(false); onAddExpense(); }} className="flex items-center justify-between gap-3 pl-4 pr-1.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{ width: 148, background: C.surfaceAlt, color: C.text, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
            Gasto <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.gold, color: "var(--gold-contrast)" }}><Plus size={16} /></span>
          </button>
          <button onClick={() => { setOpen(false); onAddIncome(); }} className="flex items-center justify-between gap-3 pl-4 pr-1.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{ width: 148, background: C.surfaceAlt, color: C.text, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
            Receita <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}><Plus size={16} /></span>
          </button>
        </>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-label={open ? "Fechar menu de adicionar" : "Adicionar gasto ou receita"} className="rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{ width: 54, height: 54, background: HERO_GRADIENT, boxShadow: "0 10px 24px rgba(0,0,0,0.4)", transform: open ? "rotate(45deg)" : "none" }}>
        <Zap size={22} color="#fff" style={{ display: open ? "none" : "block" }} />
        <Plus size={24} color="#fff" style={{ display: open ? "block" : "none" }} />
      </button>
      {open && <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}