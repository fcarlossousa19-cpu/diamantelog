// ====================================================================
// CLOUDFLARE PAGES ACTIONS / API WILDCARD ROUTER
// Conectado diretamente ao Cloudflare D1 SQL (5GB Grátis)
// ====================================================================

interface Env {
  DB: D1Database;
  SECURITY_SECRET?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Cabeçalhos CORS padrão para permitir transições limpas
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Secure-Token, Authorization",
  };

  // Tratar requisição pré-vôo (Preflight Options)
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validação Segura do Token do Sistema
  const headerToken = request.headers.get("X-Secure-Token") || url.searchParams.get("token");
  const expectedSecret = env.SECURITY_SECRET || "distribuidora_dlog_secure_token_2026";
  
  if (headerToken !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Acesso não autorizado ao banco de dados." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    // -------------------------------------------------------------
    // ROTA 1: GET /api/db/sync
    // Obtém todos os dados agrupados por tabela em uma única chamada. Ultra Rápido!
    // -------------------------------------------------------------
    if (path === "/functions/api/db/sync" || path === "/api/db/sync") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      // Certificar que a tabela de documentos existe antes de consultar
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS documents (
          collection_name TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (collection_name, id)
        )
      `).run();

      const { results } = await env.DB.prepare(
        "SELECT collection_name, id, data FROM documents"
      ).all();
      
      const mockResult: Record<string, any[]> = {};
      results.forEach((row: any) => {
        const col = row.collection_name;
        if (!mockResult[col]) {
          mockResult[col] = [];
        }
        try {
          mockResult[col].push(JSON.parse(row.data));
        } catch (e) {
          console.error("Failed to parse row data: " + row.id, e);
        }
      });
      
      return new Response(JSON.stringify({ collections: mockResult }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // -------------------------------------------------------------
    // ROTA 2: POST /api/db/set
    // Insere ou atualiza um documento na tabela correspondente de D1
    // -------------------------------------------------------------
    if (path === "/functions/api/db/set" || path === "/api/db/set") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      const payload: any = await request.json();
      const { collection, id, data } = payload;
      
      if (!collection || !id || !data) {
        return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      await env.DB.prepare(
        "INSERT OR REPLACE INTO documents (collection_name, id, data, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(collection, id, JSON.stringify(data), Date.now()).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // -------------------------------------------------------------
    // ROTA 3: POST /api/db/delete
    // Remove individualmente um documento do banco de dados D1
    // -------------------------------------------------------------
    if (path === "/functions/api/db/delete" || path === "/api/db/delete") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      const payload: any = await request.json();
      const { collection, id } = payload;
      
      if (!collection || !id) {
        return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      await env.DB.prepare(
        "DELETE FROM documents WHERE collection_name = ? AND id = ?"
      ).bind(collection, id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // -------------------------------------------------------------
    // ROTA 4: POST /api/db/batch
    // Executa transações múltiplos set/deletes em uma única execução em D1
    // -------------------------------------------------------------
    if (path === "/functions/api/db/batch" || path === "/api/db/batch") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      const payload: any = await request.json();
      const { operations } = payload; // Array de { type: 'set'|'delete', collection, id, data? }
      
      if (!Array.isArray(operations)) {
        return new Response(JSON.stringify({ error: "Operações em lote inválidas" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const statements = [];
      for (const op of operations) {
        if (op.type === "set" && op.collection && op.id && op.data) {
          statements.push(
            env.DB.prepare(
              "INSERT OR REPLACE INTO documents (collection_name, id, data, updated_at) VALUES (?, ?, ?, ?)"
            ).bind(op.collection, op.id, JSON.stringify(op.data), Date.now())
          );
        } else if (op.type === "delete" && op.collection && op.id) {
          statements.push(
            env.DB.prepare(
              "DELETE FROM documents WHERE collection_name = ? AND id = ?"
            ).bind(op.collection, op.id)
          );
        }
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Caso de rota desconhecida
    return new Response(JSON.stringify({ error: "Endpoint de API não encontrado: " + path }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unknown error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};
