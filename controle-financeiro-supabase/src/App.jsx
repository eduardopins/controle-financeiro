Skip to content
eduardopins
controle-financeiro
Repository navigation
Code
Issues
Pull requests
Agents
Actions
Projects
Wiki
Security and quality
Insights
Settings
Files
Go to file
t
T
lib content loaded
controle-financeiro-supabase
public
icon.svg
manifest.json
sw.js
src
lib
supabaseClient.js
App.jsx
index.css
main.jsx
index.html
package.json
postcss.config.js
tailwind.config.js
vite.config.js
README.md
controle-financeiro/controle-financeiro-supabase/src
/
App.jsx
in
main

Edit

Preview
Indent mode

Spaces
Indent size

2
Line wrap mode

No wrap
Editing App.jsx file contents
  1
  2
  3
  4
  5
  6
  7
  8
  9
 10
 11
 12
 13
 14
 15
 16
 17
 18
 19
 20
 21
 22
 23
 24
 25
 26
 27
 28
 29
 30
 31
 32
 33
 34
 35
 36
 37
 38
 39
 40
 41
 42
 43
 44
 45
 46
 47
 48
 49
 50
 51
 52
 53
 54
 55
 56
 57
 58
 59
 60
 61
 62
 63
 64
 65
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Check, Lock, ChevronRight, Download, AlertTriangle,
  Repeat, Target, Clock, Sun, Moon, Search, Paperclip, TrendingUp, TrendingDown,
  DollarSign, CheckSquare, Square, Zap,
} from "lucide-react";

/* ---------------------------------- tokens ---------------------------------- */

const C = {
  bg: "var(--bg)", bgSoft: "var(--bg-soft)", surface: "var(--surface)", surfaceAlt: "var(--surface-alt)",
  border: "var(--border)", borderStrong: "var(--border-strong)",
  gold: "var(--gold)", goldSoft: "var(--gold-soft)", text: "var(--text)", muted: "var(--muted)",
  green: "var(--green)", rose: "var(--rose)", amber: "var(--amber)", shadow: "var(--shadow)",
};

const THEME_CSS = `
html, body, #root { height: 100%; margin: 0; }
body { font-family: 'Inter', sans-serif; }
.theme-dark {
  --bg: #0A0C18; --bg-soft: #10132A; --surface: #151933; --surface-alt: #1C2140;
  --border: rgba(184,147,90,0.14); --border-strong: rgba(184,147,90,0.34);
  --gold: #B8935A; --gold-soft: #D8B885; --text: #F4F1E9; --muted: #8B92AC;
  --green: #5FA88C; --rose: #C97575; --amber: #CBA05A;
  --shadow: 0 10px 34px rgba(0,0,0,0.38);
}
.theme-light {
  --bg: #F7F4EE; --bg-soft: #FFFFFF; --surface: #FFFFFF; --surface-alt: #F1EBDD;
  --border: rgba(122,95,45,0.16); --border-strong: rgba(122,95,45,0.32);
  --gold: #8A6A34; --gold-soft: #6E5427; --text: #201D17; --muted: #726A59;
  --green: #2F7A5C; --rose: #A8504F; --amber: #8A6A2A;
  --shadow: 0 10px 28px rgba(70,55,25,0.10);
}
`;

const CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Educação", "Outros"];
const CAT_COLORS = {
  "Alimentação": "#F59E0B", "Moradia": "#3B82F6", "Transporte": "#10B981",
  "Lazer": "#EC4899", "Saúde": "#EF4444", "Compras": "#8B5CF6",
  "Educação": "#06B6D4", "Outros": "#6B7280",
};
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ---------------------------------- utils ---------------------------------- */

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const firstName = (n) => (n || "").split(" ")[0];
const monthKeyFromDate = (dateStr) => dateStr.slice(0, 7);
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
function diffMonths(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`; };
function addMonthsToKey(key, n) {
  const [y, m] = key.split("-").map(Number);
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
 
lib content loaded
