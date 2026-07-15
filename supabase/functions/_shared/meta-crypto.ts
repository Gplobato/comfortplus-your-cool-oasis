// Shared crypto helpers for Meta integration: AES-GCM token encryption and HMAC-signed OAuth state.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const secret = Deno.env.get("META_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new Error("META_TOKEN_ENCRYPTION_KEY missing");
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64urlEncode(out);
}

export async function decryptSecret(payload: string): Promise<string> {
  const secret = Deno.env.get("META_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new Error("META_TOKEN_ENCRYPTION_KEY missing");
  const key = await deriveKey(secret);
  const raw = b64urlDecode(payload);
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("META_OAUTH_STATE_SECRET");
  if (!secret) throw new Error("META_OAUTH_STATE_SECRET missing");
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type StatePayload = {
  org_id: string;
  user_id: string;
  return_origin: string;
  nonce: string;
  ts: number;
};

export async function signState(payload: StatePayload): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyState(token: string, maxAgeSec = 900): Promise<StatePayload> {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Malformed state");
  const key = await hmacKey();
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(body));
  if (!ok) throw new Error("Invalid state signature");
  const payload = JSON.parse(dec.decode(b64urlDecode(body))) as StatePayload;
  if (Date.now() / 1000 - payload.ts > maxAgeSec) throw new Error("State expired");
  return payload;
}

// Origins allowed to receive the OAuth completion redirect.
const ALLOWED_ORIGIN_SUFFIXES = [".lovable.app", ".lovable.dev", "localhost"];

export function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return false;
    return ALLOWED_ORIGIN_SUFFIXES.some(
      (suf) => u.hostname === suf.replace(/^\./, "") || u.hostname.endsWith(suf),
    );
  } catch {
    return false;
  }
}
