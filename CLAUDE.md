# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Aplicação Flask + Postgres multi-cliente (multi-tenant) que calcula a
premiação variável de gerentes de farmácia. Cada cliente (empresa/mentorado)
tem login próprio e só enxerga os próprios gerentes/lojas; existe um login
super-admin separado que gerencia a lista de clientes.

## Comandos

Rodar localmente (não há suíte de testes automatizada nem linter configurado
neste repo):

```
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."   # string de conexão do Neon (não é o Postgres do Render)
export SECRET_KEY="qualquer-string-aleatoria"
export ADMIN_USERNAME="arthur"
export ADMIN_PASSWORD_HASH="$(python -c 'from werkzeug.security import generate_password_hash; print(generate_password_hash(input("senha: "), method="pbkdf2:sha256"))')"
export SESSION_COOKIE_SECURE="0"   # só localmente, sem HTTPS
psql "$DATABASE_URL" -f schema.sql   # idempotente — seguro rodar de novo após puxar mudanças no schema
python app.py
```

Produção usa `gunicorn app:app` (ver `Procfile`/`render.yaml`).

Sempre usar `method="pbkdf2:sha256"` ao gerar hash de senha — o padrão
`scrypt` do Werkzeug falha em ambientes sem suporte do OpenSSL.

## Banco de dados e deploy

O Postgres é hospedado no **Neon** (free tier, sem expiração), não no
Render — o Render free tier expira bancos em 30 dias, inviável para reter
histórico de premiação. O web service fica no Render (free tier). Por isso
`render.yaml` só declara o web service; `DATABASE_URL` é uma env var secreta
(`sync: false`) apontando pro Neon, configurada manualmente no painel do
Render junto com `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`.

## Arquitetura

**Modelo de dados** (`schema.sql`): `clientes` → `gerentes` → `indicadores`
(template "vivo", editável a qualquer momento) → `calculos` + `calculo_itens`
+ `calculo_ajustes` (snapshot congelado de cada mês salvo). Editar o template
de indicadores depois nunca reescreve meses já salvos, porque `calculo_itens`
guarda uma cópia própria de cada campo no momento do save.

**Autenticação** (`auth.py`): dois níveis de sessão, sem tabela de admin —
`ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` são env vars (só existe 1 super-admin).
Clientes autenticam contra a tabela `clientes` (senha com hash). Decorators
`admin_required`/`login_required` protegem as rotas. Toda rota que recebe um
`gerente_id` de uma sessão de cliente deve carregar o registro via
`carregar_gerente()` (em `app.py`), que filtra por `cliente_id=session['cliente_id']`
e dá 404 se não pertencer — é o único ponto de defesa contra um cliente
acessar dados de outro (IDOR). As rotas `/admin/clientes/<id>/gerentes*` e
`/admin/gerentes/.../copiar-de/...` são a **única** exceção intencional: o
super-admin pode ver/copiar indicadores entre clientes diferentes.

**Fórmula de premiação** (`calculo.py`): função pura, sem Flask/DB — é a
fonte da verdade. O mesmo motor está duplicado em `static/calculadora.js`
(em JS) só para feedback visual ao vivo; o servidor **sempre recalcula** no
POST de salvar (`/gerentes/<id>/mes/<mes>/salvar`), nunca confia no total
calculado que veio do navegador. Se a fórmula mudar em `calculo.py`, replicar
manualmente em `calculadora.js` (não há código compartilhado entre os dois).

Ponto não óbvio da fórmula: o campo `teto` do gerente (rotulado "Prêmio
Total" na UI) representa o valor pago quando o indicador atinge a **super
meta** (`mult_max`), não a meta exata (100%). Bater exatamente a meta paga
proporcionalmente menos (`mult / mult_max`). Cada indicador pode ser marcado
`eh_gatilho`: se cair abaixo do próprio `minimo_pct`, zera o bloco inteiro
(substituiu heurísticas antigas e frágeis tipo "olhar a primeira linha" ou
"nome contém 'audit'"). "Ajustes" (`calculo_ajustes`) são prêmios extras ou
penalidades de valor livre aplicados sobre o total do mês, tipo fluxo de
caixa; o total nunca fica negativo (trava em zero).

**Padrão de salvar listas editáveis**: tanto os indicadores (`/gerentes/<id>/indicadores`)
quanto os itens/ajustes de um mês salvo usam "apagar tudo e reinserir" numa
transação, em vez de diffs granulares linha a linha — mais simples de
raciocinar já que não é histórico (indicadores) ou é sempre substituído
por completo (itens/ajustes de um `calculo`).

**Acesso a dados** (`db.py`): psycopg2 puro, sem ORM. `db()` retorna um
wrapper `_DB` que também funciona como context manager (`with db() as conn:`
comita ou reverte automaticamente); para leituras simples usa-se
`conn = db(); ...; conn.close()` sem transação explícita.

**Frontend**: Jinja2 + JS puro (sem build step/bundler/framework). Todo o
CSS fica em `static/estilos.css`, compartilhado entre as telas de admin,
cliente e a calculadora. A tela da calculadora (`templates/calculadora.html`
+ `static/calculadora.js`) reconstrói as linhas da tabela (`montarBloco`/
`montarAjustes`) só uma vez ao carregar; a cada tecla digitada, só os
valores calculados são atualizados via `getElementById` — nunca recriar o
DOM dos campos de entrada a cada input, ou o cursor perde o foco.

**Exportação**: rota `/gerentes/<id>/mes/<mes>/exportar.xlsx` gera a
planilha com `openpyxl`, reaproveitando `carregar_calculo_mes()` (helper
compartilhado com a rota HTML da calculadora) para montar os mesmos dados.
