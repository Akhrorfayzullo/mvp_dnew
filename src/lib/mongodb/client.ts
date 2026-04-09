import mongoose from 'mongoose'
import dns from 'dns'

// Node.js on Windows may default to 127.0.0.1 DNS, breaking SRV lookups.
// Force public resolvers so mongodb+srv:// connection strings work.
dns.setServers(['8.8.8.8', '1.1.1.1'])

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null }
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('Please define MONGODB_URI in .env.local')
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m.connection)
  }

  cached.conn = await cached.promise
  return cached.conn
}
