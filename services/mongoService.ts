
/**
 * MongoDB Atlas Data API Service
 * This service allows the frontend to communicate with MongoDB without a dedicated backend.
 * In a production environment, you would configure your Atlas Data API at:
 * https://www.mongodb.com/docs/atlas/api/data-api/
 */

const MONGODB_API_KEY = (process.env as any).MONGODB_API_KEY || '';
const MONGODB_ENDPOINT = (process.env as any).MONGODB_URL || '';
const CLUSTER_NAME = 'Cluster0';
const DATABASE = 'mealers_connect';

async function mongoFetch(action: string, collection: string, body: any) {
  if (!MONGODB_API_KEY || !MONGODB_ENDPOINT) {
    console.warn('MongoDB credentials missing. Running in local-only mode.');
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
    return await response.json();
  } catch (error) {
    console.error(`MongoDB ${action} error:`, error);
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
