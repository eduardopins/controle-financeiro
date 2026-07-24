

/* ---------------------------------- tokens ---------------------------------- */

export const C = {
  bg: "var(--bg)", bgSoft: "var(--bg-soft)", surface: "var(--surface)", surfaceAlt: "var(--surface-alt)",
  border: "var(--border)", borderStrong: "var(--border-strong)",
  gold: "var(--gold)", goldSoft: "var(--gold-soft)", text: "var(--text)", muted: "var(--muted)",
  green: "var(--green)", rose: "var(--rose)", amber: "var(--amber)", shadow: "var(--shadow)",
};

export const THEME_CSS = `
html, body, #root { height: 100%; margin: 0; }
body { font-family: 'Inter', sans-serif; }
input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
input[type=range]::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
.app-input:focus { box-shadow: 0 0 0 2px var(--gold); }
button:focus-visible, a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
#printable-report { display: none; }
@media print {
  body * { visibility: hidden; }
  #printable-report, #printable-report * { visibility: visible; }
  #printable-report { display: block; position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
}
@keyframes item-enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.animate-item-enter { animation: item-enter 0.28s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .animate-item-enter { animation: none; }
}
.theme-dark {
  --bg: #0A0C18; --bg-soft: #10132A; --surface: #151933; --surface-alt: #1C2140;
  --border: rgba(184,147,90,0.14); --border-strong: rgba(184,147,90,0.34);
  --gold: #6E7EB0; --gold-soft: #95A4D6; --gold-deep: #2E3552; --gold-contrast: #FFFFFF; --text: #F4F1E9; --muted: #8B92AC;
  --green: #5FA88C; --rose: #C97575; --amber: #CBA05A;
  --shadow: 0 10px 34px rgba(0,0,0,0.38);
}
.theme-light {
  --bg: #F7F4EE; --bg-soft: #FFFFFF; --surface: #FFFFFF; --surface-alt: #F1EBDD;
  --border: rgba(122,95,45,0.16); --border-strong: rgba(122,95,45,0.32);
  --gold: #4C5A8C; --gold-soft: #37426A; --gold-deep: #232A45; --gold-contrast: #FFFFFF; --text: #201D17; --muted: #726A59;
  --green: #2F7A5C; --rose: #A8504F; --amber: #8A6A2A;
  --shadow: 0 10px 28px rgba(70,55,25,0.10);
}
`;

export const CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Assinaturas", "Educação", "Outros"];
export const CAT_COLORS = {
  "Alimentação": "#F2994A", "Moradia": "#4A90D9", "Transporte": "#27AE60",
  "Lazer": "#E84393", "Saúde": "#EB5757", "Compras": "#9B59B6", "Assinaturas": "#17A2A0",
  "Educação": "#6C5CE7", "Outros": "#9AA3B5",
};
export const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_FULL_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

export const BANK_BRANDS = {
  "nubank": { label: "Nubank", color: "#8A05BE", mono: "NU" },
  "itau": { label: "Itaú", color: "#EC7000", mono: "IT" },
  "itaú": { label: "Itaú", color: "#EC7000", mono: "IT" },
  "inter": { label: "Inter", color: "#FF7A00", mono: "IN" },
  "bradesco": { label: "Bradesco", color: "#CC092F", mono: "BR" },
  "santander": { label: "Santander", color: "#EC0000", mono: "SA" },
  "banco do brasil": { label: "Banco do Brasil", color: "#F8D117", mono: "BB", darkText: true },
  "caixa": { label: "Caixa", color: "#0070AD", mono: "CX" },
  "c6": { label: "C6 Bank", color: "#242424", mono: "C6" },
  "picpay": { label: "PicPay", color: "#21C25E", mono: "PP" },
  "mercado pago": { label: "Mercado Pago", color: "#00AAFF", mono: "MP" },
  "next": { label: "Next", color: "#00E28A", mono: "NX", darkText: true },
  "xp": { label: "XP", color: "#000000", mono: "XP" },
  "neon": { label: "Neon", color: "#00D2C3", mono: "NE", darkText: true },
  "will": { label: "Will Bank", color: "#FFD200", mono: "WB", darkText: true },
  "original": { label: "Banco Original", color: "#00A868", mono: "OR" },
  "btg": { label: "BTG Pactual", color: "#0B2545", mono: "BT" },
  "magalu": { label: "Magalu", color: "#0087FF", mono: "MG" },
  "luizacred": { label: "Magalu", color: "#0087FF", mono: "MG" },
};
export const HERO_GRADIENT = "linear-gradient(135deg, var(--gold), var(--gold-deep))";

export const MIN_INVOICE_MONTH = "2026-07";

export const FALLBACK_CAT_COLORS = ["#F2994A", "#4A90D9", "#27AE60", "#E84393", "#EB5757", "#9B59B6", "#17A2A0", "#6C5CE7", "#F1C40F", "#FF7F6B"];
export const PERSON_COLORS = ["#3B82F6", "#10B981", "#EC4899", "#F2994A", "#8C6FA8", "#06B6D4"];