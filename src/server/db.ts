import "server-only";
import { promises as dnsPromises, setServers } from "node:dns";
import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var akodEcoMongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.akodEcoMongoose ?? { conn: null, promise: null };
global.akodEcoMongoose = cached;

/**
 * Some networks hand out a DNS server Node cannot use for SRV lookups (mongodb+srv:// fails with
 * querySrv ECONNREFUSED although Windows resolves it). Fall back to public resolvers in that case.
 */
async function ensureSrvDns(uri: string): Promise<void> {
  if (!uri.startsWith("mongodb+srv://")) return;
  const host = uri.replace("mongodb+srv://", "").split(/[/?]/)[0].split("@").pop()!;
  try {
    await dnsPromises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch {
    setServers(["1.1.1.1", "8.8.8.8"]);
  }
}

/** One shared connection per server process (survives dev hot reloads). */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local.");

  if (!cached.promise) {
    cached.promise = ensureSrvDns(uri).then(() => mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    }));
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
