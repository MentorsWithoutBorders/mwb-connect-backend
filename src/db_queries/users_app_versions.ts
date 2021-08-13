import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import AppVersion from '../models/app_version.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersAppVersions {
  constructor() {
    autoBind(this);
  }

  async addAppVersion(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const { major, minor, revision, build }: AppVersion = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteAppVersionQuery = `DELETE FROM users_app_versions 
        WHERE user_id = $1`;
      await client.query(deleteAppVersionQuery, [userId]);      
      const insertAppVersionQuery = `INSERT INTO users_app_versions (user_id, major, minor, revision, build) 
        VALUES ($1, $2, $3, $4, $5)`;
      const values = [userId, major, minor, revision, build];  
      await client.query(insertAppVersionQuery, values);      
      response.status(200).send(`App version has been updated for user: ${userId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(500).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

