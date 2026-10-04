import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function key() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Google token encryption is not configured.")
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptSecret(value: string) {
  const [version, ivB64, tagB64, dataB64] = value.split(".")
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Unsupported encrypted token format.")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8")
}
