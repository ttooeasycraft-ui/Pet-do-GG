import { MongoClient, type Db } from 'mongodb';

const GAME_DATABASE_NAME = 'antispam-jogo';

let database: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export async function connectGameDatabase(): Promise<Db> {
  if (database) return database;
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não está configurado.');
  }

  const pendingConnection = (async () => {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
    });
    try {
      await client.connect();

      const selectedDatabase = client.db(GAME_DATABASE_NAME);
      await selectedDatabase.command({ ping: 1 });
      await Promise.all([
        selectedDatabase.collection('players').createIndex({ wins: -1, updatedAt: 1 }),
        selectedDatabase.collection('matches').createIndex({ createdAt: -1 }),
      ]);

      database = selectedDatabase;
      console.log(`[GameDB] Conectado ao database ${GAME_DATABASE_NAME}.`);
      return selectedDatabase;
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  })();

  connectionPromise = pendingConnection;
  try {
    return await pendingConnection;
  } catch (error) {
    if (connectionPromise === pendingConnection) connectionPromise = null;
    throw error;
  }
}

export function getGameDatabase(): Db | null {
  return database;
}
