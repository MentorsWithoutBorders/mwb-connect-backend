import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Fields {
  async getFields(request: Request, response: Response): Promise<void> {
    try {
      const getQuery: string = 'SELECT * FROM fields ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getQuery);
      response.status(200).json(rows);
    } catch (error) {
      response.status(400).send(error);
    }   
  }
}

