-- ====================================================================
-- CLOUDFLARE D1 DATABASE SCHEMA
-- Distribuidora de Entregas - Sistema de Alta Performance (Até 5GB Grátis)
-- ====================================================================

-- Tabela Geral de Documentos NoSQL sobre SQL (Seguro, Rápido e Sem Migrações complexas)
CREATE TABLE IF NOT EXISTS documents (
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL, -- Dados em formato JSON
  updated_at INTEGER NOT NULL, -- Timestamp Unix
  PRIMARY KEY (collection_name, id)
);

-- Índices de Alta Performance para buscas por coleção na tabela
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_name);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
