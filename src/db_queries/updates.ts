import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import AppVersion from '../models/app_version.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class Updates {
  constructor() {
    helpers.autoBind(this);
  }

  async getUpdates(request: Request, response: Response): Promise<void> {
    try {
      const getUpdatesQuery = 'SELECT build, major, minor, revision FROM updates';
      const { rows }: pg.QueryResult = await pool.query(getUpdatesQuery);
      const updates: AppVersion = {
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

