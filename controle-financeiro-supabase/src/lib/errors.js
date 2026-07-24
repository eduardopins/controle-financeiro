

export function friendlyError(e) {
  const msg = (e?.message || "").toLowerCase();
  const code = e?.code || "";
  if (msg.includes("schema cache") || msg.includes("column")) return "O sistema está sendo atualizado. Tente novamente em alguns minutos.";
  if (msg.includes("row-level security") || msg.includes("permission denied") || code === "42501") return "Você não tem permissão para fazer essa ação.";
  if (msg.includes("duplicate key") || code === "23505") return "Esse item já existe.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Sem conexão com a internet. Verifique e tente de novo.";
  if (msg.includes("jwt") || msg.includes("expired") || msg.includes("token")) return "Sua sessão expirou. Saia e entre novamente.";
  if (!msg) return "Não foi possível salvar. Tente novamente.";
  return "Não foi possível salvar. Tente novamente em instantes.";
}

// Wraps an async handler so that any error it throws (ex: uma chamada ao Supabase
// que falhou) vira um aviso visível para quem está usando o app, em vez de sumir
// silenciosamente (unhandled promise rejection). Uso:
//   const handleDelete = guardedHandler(async (inc) => { ...; await refresh(); }, "excluir a receita");
export function guardedHandler(fn, actionLabel = "concluir a ação") {
  let inFlight = false;
  return async (...args) => {
    if (inFlight) return undefined; // ignora cliques repetidos enquanto a ação anterior ainda está em andamento
    inFlight = true;
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`Falha ao ${actionLabel}:`, e);
      alert(`Não foi possível ${actionLabel}. ${friendlyError(e)}`);
      return undefined;
    } finally {
      inFlight = false;
    }
  };
}