
/**
 * MongoDB Atlas Data API Service
 * 
 * Connection Info provided:
 * Cluster: cluster0.q1dd0l0.mongodb.net
 * App Name: Cluster0
 * 
 * Note: To use MongoDB directly from a frontend React app, you must use the 
 * MongoDB Atlas Data API. Standard 'mongodb' driver code (MongoClient) is for 
 * Node.js backends only.
 * 
 * SETUP STEPS for Atlas Data API:
 * 1. Go to MongoDB Atlas Dashboard -> Data Services -> Data API.
 * 2. Enable Data API for "Cluster0".
 * 3. Create an API Key.
 * 4. Set MONGODB_API_KEY and MONGODB_URL (endpoint) in your .env file.
 */

const MONGODB_API_KEY = (process.env as any).MONGODB_API_KEY || '';
const MONGODB_ENDPOINT = (process.env as any).MONGODB_URL || ''; 
const CLUSTER_NAME = 'Cluster0';
const DATABASE = 'mealers_connect';

async function mongoFetch(action: string, collection: string, body: any) {
  if (!MONGODB_API_KEY || !MONGODB_ENDPOINT) {
    console.warn(
      'MongoDB Atlas Data API credentials missing in .env.\n' +
      'Please set MONGODB_API_KEY and MONGODB_URL.\n' +
      'Running in local-only mode (offline).'
    );
    return null;
  }

  // Safety check for incorrect URL type
  if (MONGODB_ENDPOINT.startsWith('mongodb')) {
      console.error(
          'CONFIGURATION ERROR: MONGODB_URL in .env is a Connection String (starts with mongodb://).\n' +
          'The React Frontend cannot connect directly to MongoDB using TCP.\n' + 
          'Please use the "Data API URL Endpoint" (starts with https://) from the Atlas Dashboard -> Data Services.'
      );
      return null;
  }

  try {
    const response = await fetch(`${MONGODB_ENDPOINT}/action/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Request-Headers': '*',
        'api-key': MONGODB_API_KEY,
      },
      body: JSON.stringify({
        dataSource: CLUSTER_NAME,
        database: DATABASE,
        collection: collection,
        ...body,
      }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`MongoDB Data API Error (${action}):`, errorText);
        return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`MongoDB Fetch Exception (${action}):`, error);
    return null;
  }
}

export const mongoService = {
  // Postings
  async getPostings() {
    const res = await mongoFetch('find', 'postings', { filter: {}, sort: { createdAt: -1 } });
    return res?.documents || [];
  },
  async upsertPosting(posting: any) {
    return await mongoFetch('updateOne', 'postings', {
      filter: { id: posting.id },
      update: { $set: posting },
      upsert: true
    });
  },
  async deletePosting(id: string) {
    return await mongoFetch('deleteOne', 'postings', { filter: { id: id } });
  },

  // Users
  async getUsers() {
    const res = await mongoFetch('find', 'users', { filter: {} });
    return res?.documents || [];
  },
  async upsertUser(user: any) {
    return await mongoFetch('updateOne', 'users', {
      filter: { id: user.id },
      update: { $set: user },
      upsert: true
    });
  },

  // Chats
  async getMessages(postingId: string) {
    const res = await mongoFetch('find', 'chats', { filter: { postingId } });
    return res?.documents || [];
  },
  async insertMessage(message: any) {
    return await mongoFetch('insertOne', 'chats', { document: message });
  }
};
