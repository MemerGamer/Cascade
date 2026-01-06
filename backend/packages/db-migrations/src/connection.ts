import mongoose from 'mongoose';

export async function connectDB(uri: string) {
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB: ${uri}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

export async function ensureIndexes(connection: mongoose.Connection) {
  const collections = await connection.db?.listCollections().toArray();
  console.log('Ensuring indexes for collections...');

  // Add index creation logic here
  // Example:
  // await connection.collection('users').createIndex({ email: 1 }, { unique: true });

  console.log('Indexes ensured');
}
