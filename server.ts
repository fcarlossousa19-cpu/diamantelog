import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Safe JSON file-system based Database for Local Development in AI Studio
const DB_FILE = path.join(process.cwd(), "local_db.json");

function readLocalDB(): Record<string, any[]> {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({}), "utf8");
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed reading local dev database, resetting:", e);
    return {};
  }
}

function writeLocalDB(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed writing to local dev database file:", e);
  }
}

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

if (isSupabaseConfigured) {
  console.log("Supabase Client initialized successfully! System will connect to production database.");
} else {
  console.log("Supabase variables not set. Running with Local JSON File Database fallback.");
}

// Recursive helper to identify base64 images in document payload, upload to Supabase Storage 'arquivos' and return the secure URLs
async function handleBase64Uploads(data: any, collection: string, id: string): Promise<any> {
  if (!supabase) return data;
  if (!data || typeof data !== "object") return data;

  const result = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === "string" && value.startsWith("data:") && value.includes(";base64,")) {
      try {
        const mimeType = value.split(";")[0].split(":")[1]; // e.g., image/png
        const extension = mimeType.split("/")[1] || "png";
        const base64Data = value.split(";base64,")[1];
        const buffer = Buffer.from(base64Data, "base64");

        // Path format: collection/id_key_timestamp.extension
        const fileName = `${collection}/${id}_${key}_${Date.now()}.${extension}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("arquivos")
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadError) {
          console.error(`Error uploading base64 '${key}' to Supabase Storage bucket 'arquivos':`, uploadError);
          continue;
        }

        // Try getting a signed URL with 10 years lifetime (since it is a private bucket)
        let fileUrl = "";
        const { data: signedData, error: signedError } = await supabase.storage
          .from("arquivos")
          .createSignedUrl(fileName, 315360000); // 10 years in seconds

        if (!signedError && signedData?.signedUrl) {
          fileUrl = signedData.signedUrl;
        } else {
          // If signed fails (e.g. bucket is public instead of private or permission missing), get the public URL
          const { data: publicUrlData } = supabase.storage
            .from("arquivos")
            .getPublicUrl(fileName);
          fileUrl = publicUrlData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/arquivos/${fileName}`;
        }

        console.log(`Uploaded Base64 image for [${collection}/${id}][${key}] -> ${fileUrl}`);
        result[key] = fileUrl;
      } catch (err) {
        console.error(`Failed during Base64 file parsing/upload in handleBase64Uploads:`, err);
      }
    } else if (value && typeof value === "object") {
      result[key] = await handleBase64Uploads(value, collection, id);
    }
  }

  return result;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security token to validate requests
  const API_TOKEN = 'distribuidora_dlog_secure_token_2026';

  // Enable body parsing
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ limit: '60mb', extended: true }));

  // Middleware to authenticate via local API_TOKEN
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers['x-secure-token'];
    if (token !== API_TOKEN && req.path !== "/api/health") {
      console.warn("Unauthorized API access attempt block!");
      return res.status(401).json({ error: "Unauthorized access: Token inválido!" });
    }
    next();
  };

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", supabase: isSupabaseConfigured });
  });

  // API to download the compiled dist folder as a ZIP file
  app.get("/api/download-dist", async (req, res) => {
    try {
      // @ts-ignore
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip();
      const targetDir = path.join(process.cwd(), "dist");

      if (!fs.existsSync(targetDir)) {
        return res.status(500).json({ error: "A pasta 'dist' não foi encontrada. Por favor compile o projeto primeiro." });
      }

      zip.addLocalFolder(targetDir);
      const zipBuffer = zip.toBuffer();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=dist.zip");
      res.send(zipBuffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===============================================
  // DATABASE API HANDLERS (SUPABASE METRIC PROXY)
  // ===============================================

  // 1. GET /api/db/sync - Retorna todas as coleções do banco
  app.get("/api/db/sync", authenticateToken, async (req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("*");

        if (error) {
          console.error("Supabase select sync failed:", error.message);
          return res.status(500).json({ error: error.message });
        }

        const collections: Record<string, any[]> = {};
        data?.forEach((row: any) => {
          const col = row.collection_name;
          if (!collections[col]) {
            collections[col] = [];
          }
          try {
            const docObj = (typeof row.data === "string") ? JSON.parse(row.data) : row.data;
            collections[col].push(docObj);
          } catch (err) {
            console.error(`JSON Parse error for row ID ${row.id}:`, err);
          }
        });

        res.json({ collections });
      } catch (err: any) {
        console.error("Sync Supabase exception:", err);
        res.status(500).json({ error: err.message });
      }
    } else {
      // Fallback local DB
      const dbData = readLocalDB();
      res.json({ collections: dbData });
    }
  });

  // 2. POST /api/db/set - Insere ou Atualiza um documento
  app.post("/api/db/set", authenticateToken, async (req, res) => {
    let { collection, id, data } = req.body;
    if (!collection || !id || !data) {
      return res.status(400).json({ error: "Missing required params: collection, id, or data" });
    }

    if (supabase) {
      try {
        // Intercept profile photos & CNH documents to upload to Supabase Storage Storage Bucket
        data = await handleBase64Uploads(data, collection, id);

        const { error } = await supabase
          .from("documents")
          .upsert({
            collection_name: collection,
            id: id,
            data: data, // postgrest supports passing object for JSONB or we can pass JSON.stringify(data)
            updated_at: Date.now()
          });

        if (error) {
          console.error(`Supabase Insert/Upsert failed:`, error.message);
          return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
      } catch (err: any) {
        console.error(`Supabase persistence error:`, err);
        res.status(500).json({ error: err.message });
      }
    } else {
      // Fallback local
      const dbData = readLocalDB();
      if (!dbData[collection]) {
        dbData[collection] = [];
      }

      const idx = dbData[collection].findIndex((item: any) => item.id === id);
      if (idx > -1) {
        dbData[collection][idx] = data;
      } else {
        dbData[collection].push(data);
      }

      writeLocalDB(dbData);
      res.json({ success: true, data });
    }
  });

  // 3. POST /api/db/delete - Deleta um documento
  app.post("/api/db/delete", authenticateToken, async (req, res) => {
    const { collection, id } = req.body;
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from("documents")
          .delete()
          .eq("collection_name", collection)
          .eq("id", id);

        if (error) {
          console.error(`Supabase delete failed:`, error.message);
          return res.status(500).json({ error: error.message });
        }

        res.json({ success: true });
      } catch (err: any) {
        console.error("Supabase delete exception:", err);
        res.status(500).json({ error: err.message });
      }
    } else {
      // Fallback local
      const dbData = readLocalDB();
      if (dbData[collection]) {
        dbData[collection] = dbData[collection].filter((item: any) => item.id !== id);
        writeLocalDB(dbData);
      }
      res.json({ success: true });
    }
  });

  // 4. POST /api/db/batch - Transações em lote combinadas
  app.post("/api/db/batch", authenticateToken, async (req, res) => {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: "Operations must be an array" });
    }

    if (supabase) {
      try {
        const upserts: any[] = [];
        const deletes: { collection_name: string; id: string }[] = [];

        for (const op of operations) {
          const { type, collection, id } = op;
          let { data } = op;
          if (!collection || !id) continue;

          if (type === "set" && data) {
            data = await handleBase64Uploads(data, collection, id);
            upserts.push({
              collection_name: collection,
              id: id,
              data: data,
              updated_at: Date.now()
            });
          } else if (type === "delete") {
            deletes.push({ collection_name: collection, id: id });
          }
        }

        if (upserts.length > 0) {
          const { error: upsertError } = await supabase
            .from("documents")
            .upsert(upserts);
          if (upsertError) {
            console.error("Supabase batch upsert failed:", upsertError.message);
            return res.status(500).json({ error: upsertError.message });
          }
        }

        for (const del of deletes) {
          const { error: deleteError } = await supabase
            .from("documents")
            .delete()
            .eq("collection_name", del.collection_name)
            .eq("id", del.id);
          if (deleteError) {
            console.error("Supabase batch delete item failed:", deleteError.message);
          }
        }

        res.json({ success: true });
      } catch (err: any) {
        console.error("Supabase batch transaction exception:", err);
        res.status(500).json({ error: err.message });
      }
    } else {
      // Fallback local
      const dbData = readLocalDB();
      for (const op of operations) {
        const { type, collection, id, data } = op;
        if (!collection || !id) continue;

        if (!dbData[collection]) {
          dbData[collection] = [];
        }

        if (type === "set" && data) {
          const idx = dbData[collection].findIndex((item: any) => item.id === id);
          if (idx > -1) {
            dbData[collection][idx] = data;
          } else {
            dbData[collection].push(data);
          }
        } else if (type === "delete") {
          dbData[collection] = dbData[collection].filter((item: any) => item.id !== id);
        }
      }

      writeLocalDB(dbData);
      res.json({ success: true });
    }
  });

  const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production";
  const distPath = path.join(process.cwd(), "dist");

  // Middlewares and Static files for express serving
  if (isDev && fs.existsSync(path.join(process.cwd(), "vite.config.ts")) && process.env.NODE_ENV !== "production") {
    console.log("Running in Development mode with Vite Middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Running in Production/Preview mode, serving static files from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
