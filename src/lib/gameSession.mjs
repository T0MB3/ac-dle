import crypto from "node:crypto";

const DEFAULT_SECRET = "ac-dle-dev-secret";

function getSecret() {
  return process.env.GAME_SESSION_SECRET || process.env.VERCEL_URL || DEFAULT_SECRET;
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createGameId(answerId) {
  const payload = JSON.stringify({
    answerId,
    nonce: crypto.randomBytes(8).toString("hex")
  });

  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readGameId(gameId) {
  if (typeof gameId !== "string" || !gameId.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = gameId.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    return typeof payload.answerId === "string" ? payload.answerId : null;
  } catch {
    return null;
  }
}
