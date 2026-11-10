import * as Crypto from "expo-crypto";

// @cielo/core newId() uses crypto.randomUUID when available: back it with the native CSPRNG.
const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.randomUUID) g.crypto.randomUUID = () => Crypto.randomUUID();
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = Crypto.getRandomValues;
