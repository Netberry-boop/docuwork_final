import { SignJWT, jwtVerify } from "jose";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signToken(
  payload: Record<string, unknown>,
  expiresIn = "15m"
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function generateToken(length = 32) {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .slice(0, length);
}
