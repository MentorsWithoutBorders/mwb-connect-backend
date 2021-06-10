import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Subfield from '../models/subfield.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Subfields {
  constructor() {
    autoBind(this);
  }

  async getSubfields(request: Request, response: Response): Promise<void> {
    const fieldId: string = request.params.id;
    try {
      const getSubfieldsQuery = `SELECT s.id, s.name
        FROM subfields s
        INNER JOIN fields_subfields fs
        ON fs.subfield_id = s.id
        WHERE fs.field_id = $1
        ORDER BY fs.subfield_index`;
      const { rows }: pg.QueryResult = await pool.query(getSubfieldsQuery, [fieldId]);
      const subfields: Array<Subfield> = [];
      for (const row of rows) {
        const subfield: Subfield = {
          id: row.id,
          name: row.name
        };
        subfields.push(subfield);
      }
      response.status(200).json(subfields);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}

