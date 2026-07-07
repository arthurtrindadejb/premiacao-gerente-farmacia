# Premiação Gerente de Farmácia

Aplicação Flask + Postgres multi-cliente para calcular a premiação
variável dos gerentes de farmácia. Cada cliente (empresa/mentorado) tem
login próprio e só enxerga os próprios gerentes/lojas; existe um login
super-admin para gerenciar os clientes.

## Rodando localmente

```
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."   # pode ser o Postgres do Render
export SECRET_KEY="qualquer-string-aleatoria"
export ADMIN_USERNAME="arthur"
export ADMIN_PASSWORD_HASH="$(python -c 'from werkzeug.security import generate_password_hash; print(generate_password_hash(input(\"senha: \")))')"
psql "$DATABASE_URL" -f schema.sql   # só na primeira vez
python app.py
```

## Deploy

Hospedado no Render via `render.yaml` (web service Python + banco Postgres
provisionado automaticamente pelo blueprint). Depois do primeiro deploy,
rode `schema.sql` uma vez no banco criado e configure `ADMIN_USERNAME` /
`ADMIN_PASSWORD_HASH` no painel do Render (variáveis marcadas `sync: false`).
