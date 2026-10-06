import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/edunova_ai';
const STATE_ID = 'default';

const stateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'app_state' },
);

const AppState = mongoose.models.AppState || mongoose.model('AppState', stateSchema);
let connectionPromise = null;

export function mongoUri() {
  return process.env.MONGODB_URI || DEFAULT_URI;
}

export function mongoDatabaseName() {
  return mongoose.connection.name;
}

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 5000 })
    .then(() => mongoose.connection)
    .catch((err) => {
      connectionPromise = null;
      throw new Error(`MongoDB connection failed: ${err.message}`, { cause: err });
    });

  return connectionPromise;
}

export async function readAppState() {
  await connectMongo();
  const record = await AppState.findById(STATE_ID).lean();
  return record?.data ?? null;
}

export async function writeAppState(data) {
  await connectMongo();
  await AppState.updateOne(
    { _id: STATE_ID },
    { $set: { data, updatedAt: new Date() } },
    { upsert: true, runValidators: true },
  );
  return true;
}
