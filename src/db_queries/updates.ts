import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Update from '../models/update.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Updates {
  constructor() {
    autoBind(this);
  }

  async getUpdates(request: Request, response: Response): Promise<void> {
    try {
      const getUpdatesQuery = 'SELECT build, major, minor, revision FROM updates';
      const { rows }: pg.QueryResult = await pool.query(getUpdatesQuery);
      const updates: Update = {
        major: rows[0].major,
        minor: rows[0].minor,
        revision: rows[0].revision,
        build: rows[0].build
      }
      response.status(200).json(updates);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}

