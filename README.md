# Controle Financeiro Familiar

Sistema de controle financeiro com acesso por perfil, feito para uso compartilhado entre a pessoa administradora e as pessoas que usam os mesmos cartões de crédito.

## Funcionalidades

- **Administrador**: cadastra cartões (nome, limite, dia de fechamento e de vencimento), libera acesso por pessoa, vê os gastos de todos, relatórios por categoria, metas por categoria e evolução mensal.
- **Membros**: login próprio, lançam e editam apenas os próprios gastos, veem o limite restante do(s) cartão(ões) que usam e o total gasto no mês — sem acesso aos dados de outras pessoas.
- **Cartões compartilhados**: o limite é único entre quem tem acesso a um cartão — o gasto de uma pessoa afeta o limite disponível das demais.
- **Parcelamento**: compras parceladas ocupam o limite do cartão proporcionalmente até serem quitadas.
- **Gastos recorrentes**: assinaturas e contas fixas podem ser marcadas como recorrentes, contando automaticamente todo mês.
- **Histórico filtrável**: por mês atual (padrão), 1, 3, 6 ou 12 meses, ou período personalizado, com exportação em CSV.
- **Alertas**: aviso quando o limite do cartão está quase no fim e quando a fatura está próxima do vencimento.
- **Metas por categoria**: definição de um teto de gasto mensal por categoria, com acompanhamento visual.
- **Acesso temporário**: perfis podem ser marcados como convidados, com data de expiração automática.

## Stack

- **React** + **Tailwind CSS** (interface)
- **Recharts** (gráficos e relatórios)
- **lucide-react** (ícones)
- **Supabase** (banco de dados Postgres + autenticação de usuários)

## Hospedagem

O projeto é hospedado gratuitamente na **Vercel**, com deploy automático a cada atualização do repositório.

## Segurança de acesso

O controle de quem vê o quê é feito por meio de políticas de segurança em nível de linha (Row Level Security) no banco de dados: cada pessoa só consegue consultar seus próprios gastos, enquanto o administrador tem acesso irrestrito a todos os dados.
