# Controle Financeiro Familiar

App de controle financeiro com acesso por perfil (admin + membros), cartões de crédito compartilhados, limite calculado automaticamente e parcelamento de compras.

## Funcionalidades

- **Admin**: cadastra cartões (nome, limite, fechamento, vencimento), libera acesso por pessoa, vê todos os gastos, relatórios por categoria e evolução mensal por pessoa.
- **Membros**: login próprio, lançam e editam apenas os próprios gastos, veem o limite restante do(s) cartão(ões) que usam e o total gasto no mês.
- **Cartões compartilhados**: o limite é único entre quem tem acesso ao cartão — o gasto de uma pessoa afeta o limite disponível da outra.
- **Parcelamento**: compras parceladas ocupam o limite proporcionalmente até serem quitadas.

## Stack

React + Tailwind (classes utilitárias) + Recharts (gráficos) + lucide-react (ícones).

Os dados são persistidos via `window.storage` (armazenamento key-value compartilhado do artifact).

## Como rodar fora do Claude

Este componente foi feito para rodar como Claude Artifact (usa `window.storage`, disponível apenas nesse ambiente). Para rodar como projeto React standalone, seria necessário:
1. Criar um projeto (Vite ou Next.js) com Tailwind configurado
2. Instalar `recharts` e `lucide-react`
3. Substituir as chamadas de `window.storage` por localStorage, um backend, ou outro serviço de persistência
