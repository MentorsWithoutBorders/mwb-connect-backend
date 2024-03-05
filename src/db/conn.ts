import pg, { QueryResultRow } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

class DBClient {
  private poolInstance: pg.Pool;

  constructor() {
    this.poolInstance = new pg.Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS,
      port: 5432,
      idleTimeoutMillis: 3000
    });
  }

  get pool() {
    return this.poolInstance;
  }

  /**
   * If you need to execute multiple queries, using client = pool.connect() can be faster because it allows
   * you to reuse the same client for all the queries, avoiding the overhead of acquiring and releasing a client for each query.
   * @param callback (client: pg.PoolClient) => Promise<T>
   * @returns Promise
   */
  async withClient<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.poolInstance.connect();
    try {
      return await callback(client);
    } catch (e) {
      console.log(e);
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   *
   * This method internally acquires a client from the pool, executes the query, and then releases the client back to the pool.
   * It's a convenient way to execute a single query without worrying about managing the client connection.
   *
   * @param query
   * @param values
   * @param client
   * @returns pg.QueryResult
   */
  async query<T extends QueryResultRow>(
    query: string,
    values?: (string | number | boolean)[]
  ) {
    try {
      return await this.poolInstance.query<T>(query, values);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async transaction(
    asyncCallback: (client: pg.PoolClient) => unknown
  ): Promise<unknown> {
    const client = await this.poolInstance.connect();
    try {
      await client.query('BEGIN');
      const result = await asyncCallback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      console.log(e);
      await client.query('ROLLBACK');
      return e;
    } finally {
      client.release();
    }
  }
}

export const dbClient = new DBClient();

export class Conn {
  get pool() {
    return dbClient.pool;
  }
}
