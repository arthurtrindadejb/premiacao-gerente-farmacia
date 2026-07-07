-- Premiação Variável — schema Postgres
-- Rodar 1x: psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL PRIMARY KEY,
    nome            TEXT NOT NULL,
    login           TEXT NOT NULL UNIQUE,
    senha_hash      TEXT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gerentes (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    nome            TEXT NOT NULL,
    loja            TEXT NOT NULL DEFAULT '',
    teto            NUMERIC(12,2) NOT NULL DEFAULT 0,
    peso_a          NUMERIC(5,2) NOT NULL DEFAULT 50,
    peso_b          NUMERIC(5,2) NOT NULL DEFAULT 30,
    peso_c          NUMERIC(5,2) NOT NULL DEFAULT 20,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gerentes_cliente ON gerentes(cliente_id);

-- template "vivo" de indicadores, editável a qualquer momento
CREATE TABLE IF NOT EXISTS indicadores (
    id              SERIAL PRIMARY KEY,
    gerente_id      INTEGER NOT NULL REFERENCES gerentes(id) ON DELETE CASCADE,
    bloco           CHAR(1) NOT NULL CHECK (bloco IN ('A','B','C')),
    ordem           INTEGER NOT NULL DEFAULT 0,
    nome            TEXT NOT NULL,
    meta            NUMERIC(14,4) NOT NULL DEFAULT 0,
    peso            NUMERIC(5,2) NOT NULL DEFAULT 0,
    inverso         BOOLEAN NOT NULL DEFAULT FALSE,
    eh_gatilho      BOOLEAN NOT NULL DEFAULT FALSE,
    minimo_pct      NUMERIC(6,2) NOT NULL DEFAULT 85,
    teto_pct        NUMERIC(6,2) NOT NULL DEFAULT 110,
    mult_min        NUMERIC(5,2) NOT NULL DEFAULT 0.70,
    mult_max        NUMERIC(5,2) NOT NULL DEFAULT 1.20,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indicadores_gerente ON indicadores(gerente_id, bloco, ordem);

-- cabeçalho do mês (1 por gerente por mês) — snapshot dos pesos/teto do momento
CREATE TABLE IF NOT EXISTS calculos (
    id              SERIAL PRIMARY KEY,
    gerente_id      INTEGER NOT NULL REFERENCES gerentes(id) ON DELETE RESTRICT,
    mes             CHAR(7) NOT NULL,
    teto            NUMERIC(12,2) NOT NULL,
    peso_a          NUMERIC(5,2) NOT NULL,
    peso_b          NUMERIC(5,2) NOT NULL,
    peso_c          NUMERIC(5,2) NOT NULL,
    advertencia     BOOLEAN NOT NULL DEFAULT FALSE,
    desvio          BOOLEAN NOT NULL DEFAULT FALSE,
    total_a         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_b         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_c         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gerente_id, mes)
);
CREATE INDEX IF NOT EXISTS idx_calculos_gerente_mes ON calculos(gerente_id, mes);

-- cópia congelada dos indicadores usados naquele mês + valor realizado
CREATE TABLE IF NOT EXISTS calculo_itens (
    id                  SERIAL PRIMARY KEY,
    calculo_id          INTEGER NOT NULL REFERENCES calculos(id) ON DELETE CASCADE,
    indicador_origem_id INTEGER REFERENCES indicadores(id) ON DELETE SET NULL,
    bloco               CHAR(1) NOT NULL CHECK (bloco IN ('A','B','C')),
    ordem               INTEGER NOT NULL DEFAULT 0,
    nome                TEXT NOT NULL,
    meta                NUMERIC(14,4) NOT NULL,
    peso                NUMERIC(5,2) NOT NULL,
    inverso             BOOLEAN NOT NULL DEFAULT FALSE,
    eh_gatilho          BOOLEAN NOT NULL DEFAULT FALSE,
    minimo_pct          NUMERIC(6,2) NOT NULL,
    teto_pct            NUMERIC(6,2) NOT NULL,
    mult_min            NUMERIC(5,2) NOT NULL,
    mult_max            NUMERIC(5,2) NOT NULL,
    realizado           NUMERIC(14,4) NOT NULL DEFAULT 0,
    premio_calculado    NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_calculo_itens_calculo ON calculo_itens(calculo_id);

-- ajustes livres do mês (prêmios extras ou penalidades) — valor positivo soma,
-- negativo desconta do total; substitui os antigos campos advertencia/desvio
CREATE TABLE IF NOT EXISTS calculo_ajustes (
    id              SERIAL PRIMARY KEY,
    calculo_id      INTEGER NOT NULL REFERENCES calculos(id) ON DELETE CASCADE,
    ordem           INTEGER NOT NULL DEFAULT 0,
    nome            TEXT NOT NULL,
    valor           NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_calculo_ajustes_calculo ON calculo_ajustes(calculo_id);
