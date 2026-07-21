# Controle Financeiro Familiar

App de controle financeiro com acesso por perfil, cartões de crédito compartilhados, limite calculado automaticamente e parcelamento de compras.

> **O código do projeto está dentro da pasta [`controle-financeiro-supabase`](./controle-financeiro-supabase).**
> Este README na raiz é só um resumo — o README completo, com instruções técnicas, está lá dentro.

## O que o sistema faz

- **Administrador**: cadastra cartões (nome, limite, fechamento, vencimento), libera acesso por pessoa, vê todos os gastos, relatórios por categoria, metas por categoria e evolução mensal.
- **Membros**: login próprio, lançam e editam apenas os próprios gastos, veem o limite restante do(s) cartão(ões) que usam e o total gasto no mês.
- **Cartões compartilhados**: o limite é único entre quem tem acesso ao cartão — o gasto de uma pessoa afeta o limite disponível da outra.
- **Parcelamento e recorrência**: compras parceladas ocupam o limite proporcionalmente até serem quitadas; gastos recorrentes (assinaturas, contas fixas) são lançados automaticamente todo mês.
- **Histórico filtrável**: por mês atual (padrão), 1/3/6/12 meses ou período personalizado, com exportação em CSV.
- **Alertas**: aviso de limite próximo do fim e de fatura perto do vencimento.
- **Acesso temporário**: perfis podem ser marcados como convidados, com data de expiração.

## Stack

React + Tailwind + Recharts (gráficos) + lucide-react (ícones) + Supabase (banco de dados Postgres + autenticação).

Hospedado gratuitamente no **Vercel**, com deploy automático a cada atualização deste repositório.

## Estrutura

```
controle-financeiro-supabase/   ← projeto real (Vite + React)
  src/
    App.jsx                     ← aplicação principal
    lib/supabaseClient.js       ← conexão com o Supabase
  README.md                     ← detalhes técnicos completos
```
