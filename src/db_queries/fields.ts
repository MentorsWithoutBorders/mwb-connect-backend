import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Fields {
  constructor() {
    autoBind(this);
  }

  async getFields(request: Request, response: Response): Promise<void> {
    try {
      const getQuery = 'SELECT * FROM fields ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getQuery);
      const fields: Array<Field> = [];
      for (const row of rows) {
        const field: Field = {
          id: row.id,
          name: row.name,
          subfields: await this.getSubfields(row.id)
        };
        fields.push(field);
      }      
      response.status(200).json(fields);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getSubfields(fieldId: string): Promise<Array<Subfield>> {
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
    return subfields;
  }  
}

