import { prisma } from "./db.js";

// No 0/O or 1/I to avoid ambiguity when read aloud or handwritten.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 4;
const PREFIX = "DNR-";

function randomSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `${PREFIX}${randomSegment(CODE_LENGTH)}`;
    const existing = await prisma.booking.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique booking code");
}
