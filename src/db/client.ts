import pg, { QueryResultRow } from 'pg';

class DBClient {
    
    private _pool: pg.Pool;

    constructor(){
        this._pool = new pg.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASS,
            port: 5432,
            idleTimeoutMillis: 3000
        });
    }

    async withClient<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await this._pool.connect();
        try {
            return await callback(client);
        } catch(e){
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
    }

    async query<T extends QueryResultRow>(query: string, values?: any[], client?: pg.PoolClient){
        const pgClient = client ? client: await this._pool.connect();
        try{
            return await pgClient.query<T>(query, values);
        } catch(e){
            console.log(e); 
            throw e;
        } finally {
            pgClient.release();
        }
    }

    async transaction(asyncCallback:  (client: pg.PoolClient) => unknown): Promise<unknown>{
        const client = await this._pool.connect();
        try{
            await client.query('BEGIN');
            const result = await asyncCallback(client);
            await client.query('COMMIT');
            return result;
        } catch(e){
            console.log(e);
            await client.query('ROLLBACK');
            return e;
        } finally{
            client.release();
        }
    }
}

export default new DBClient();