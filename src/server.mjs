import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareGuess } from "./lib/gameLogic.mjs";
import {
  buildSearchIndex,
  findCharacterByInput,
  getAllCharacters,
  getCharacterOfDay,
  sanitizeCharacter
} from "./lib/characters.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const PORT = Number(process.env.PORT ?? 3000);

const characters = getAllCharacters();
const searchIndex = buildSearchIndex(characters);
const characterNames = characters.map((c) => c.name).sort((a, b) => a.localeCompare(b));

const server = http.createServer((req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    if (req.method === "GET" && req.url === "/api/daily") {
      return handleDaily(res);
    }

    if (req.method === "GET" && req.url === "/api/characters") {
      return handleCharacters(res);
    }

    if (req.method === "POST" && req.url === "/api/guess") {
      return handleGuess(req, res);
    }

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET") {
      return serveStatic(req.url ?? "/", res);
    }

    return sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    return sendJson(res, 500, { error: "Internal server error", details: String(error?.message ?? error) });
  }
});

function handleDaily(res) {
  const { dayKey } = getCharacterOfDay(characters);
  return sendJson(res, 200, {
    day: dayKey,
    characterCount: characters.length
  });
}

function handleCharacters(res) {
  return sendJson(res, 200, {
    characters: characterNames
  });
}

async function handleGuess(req, res) {
  const body = await readJsonBody(req);
  const rawGuess = body?.guess ?? body?.id ?? body?.name;

  if (!rawGuess || typeof rawGuess !== "string") {
    return sendJson(res, 400, {
      error: "Body invalide: fournir { \"guess\": \"nom ou id\" }"
    });
  }

  const guessedCharacter = findCharacterByInput(rawGuess, searchIndex);
  if (!guessedCharacter) {
    return sendJson(res, 404, { error: "Personnage introuvable pour ce guess." });
  }

  const { dayKey, character: answerCharacter } = getCharacterOfDay(characters);
  const feedback = compareGuess(guessedCharacter, answerCharacter);
  const isCorrect = guessedCharacter.id === answerCharacter.id;

  return sendJson(res, 200, {
    day: dayKey,
    guess: sanitizeCharacter(guessedCharacter),
    isCorrect,
    feedback
  });
}

function serveStatic(urlPath, res) {
  const safePath = normalizePublicPath(urlPath);
  const filePath = path.resolve(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendJson(res, 404, { error: "Static file not found" });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = getContentType(ext);
  const content = fs.readFileSync(filePath);

  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
}

function normalizePublicPath(urlPath) {
  if (urlPath === "/") {
    return "index.html";
  }

  const clean = String(urlPath).split("?")[0].replace(/^\/+/, "");
  return clean || "index.html";
}

function getContentType(ext) {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
