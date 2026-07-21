# Controle Financeiro Familiar (versão com banco de dados)

Versão do app conectada ao **Supabase** (banco de dados + login), pronta para ser hospedada no **Vercel**.

## O que já está pronto

- As chaves do Supabase já estão preenchidas no arquivo `.env`
- Login por e-mail/senha (crie os usuários em Supabase → Authentication → Users)
- Cada usuário precisa ter uma linha correspondente na tabela `profiles` (mesmo `id` do usuário de authentication), com `name` e `role` (`admin` ou `member`)
- Toda a segurança (quem vê o quê) já está garantida pelas regras (RLS) configuradas no banco — o próprio código não precisa filtrar nada, o Supabase já entrega só o que cada pessoa pode ver

## Subir para o GitHub (sem instalar nada)

1. Baixe todos os arquivos desta pasta (mantendo a estrutura: `src/`, `src/lib/`, etc.)
2. No seu repositório do GitHub, clique em **Add file → Upload files**
3. Arraste a pasta inteira (o GitHub mantém a estrutura de subpastas)
4. Confirme o commit

## Publicar no Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project**
2. Selecione o repositório
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → `https://wyuzctajdeqrzlxeaqqz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → (a chave anon, a mesma do arquivo `.env`)
4. Clique em **Deploy**

O Vercel detecta automaticamente que é um projeto Vite e configura o build sozinho (`npm run build`, pasta `dist`).

## Rodar localmente (opcional, exige Node.js instalado)

```bash
npm install
npm run dev
```

## Estrutura do projeto

```
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx          ← toda a lógica e telas do app
│   ├── index.css
│   └── lib/
│       └── supabaseClient.js
├── .env                 ← chaves do Supabase (a anon key é segura para expor)
├── package.json
└── tailwind.config.js
```
