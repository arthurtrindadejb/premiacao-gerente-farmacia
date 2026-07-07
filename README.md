# Premiação Gerente de Farmácia

Aplicação Flask + Postgres multi-cliente para calcular a premiação
variável dos gerentes de farmácia. Cada cliente (empresa/mentorado) tem
login próprio e só enxerga os próprios gerentes/lojas; existe um login
super-admin para gerenciar os clientes.

## Rodando localmente

```
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."   # string de conexão do Neon (ou outro Postgres)
export SECRET_KEY="qualquer-string-aleatoria"
export ADMIN_USERNAME="arthur"
export ADMIN_PASSWORD_HASH="$(python -c 'from werkzeug.security import generate_password_hash; print(generate_password_hash(input(\"senha: \")))')"
psql "$DATABASE_URL" -f schema.sql   # só na primeira vez
python app.py
```

## Banco de dados

O Postgres é hospedado no **Neon** (neon.tech, plano gratuito, sem expirar),
não no Render — assim o web service continua no plano gratuito do Render
sem custo nenhum. Crie um projeto gratuito no Neon, copie a "Connection
string" e use como `DATABASE_URL`.

## Deploy

Hospedado no Render via `render.yaml` (web service Python, plano gratuito).
Depois do primeiro deploy, rode `schema.sql` uma vez no banco do Neon
(`psql "$DATABASE_URL" -f schema.sql`) e configure no painel do Render as
variáveis marcadas `sync: false`: `DATABASE_URL` (string do Neon),
`ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH`.
