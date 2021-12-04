import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import Subfield from '../models/subfield.model';

const conn = new Conn();
const pool = conn.pool;

export class Subfields {
  constructor() {
    autoBind(this);
  }

  async getSubfields(request: Request, response: Response): Promise<void> {
    const fieldId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const subfields = await this.getSubfieldsFromDB(fieldId, client);
      response.status(200).json(subfields);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getSubfieldsFromDB(fieldId: string, client: pg.PoolClient): Promise<Array<Subfield>> {
    const getSubfieldsQuery = `SELECT s.id, s.name, fs.subfield_index
      FROM subfields s
      JOIN fields_subfields fs
        ON fs.subfield_id = s.id
      WHERE fs.field_id = $1
      ORDER BY fs.subfield_index`;
    const { rows }: pg.QueryResult = await client.query(getSubfieldsQuery, [fieldId]);
    const subfields: Array<Subfield> = [];
    for (const row of rows) {
      const subfield: Subfield = {
        id: row.id,
        name: row.name,
        index: row.subfield_index
      };
      subfields.push(subfield);
    }
    return subfields;
  }

  async getSubfieldById(request: Request, response: Response): Promise<void> {
    const subfieldId = request.params.id;
    try {
      const getSubfieldsQuery = `SELECT s.name, fs.subfield_index
        FROM subfields s
        JOIN fields_subfields fs
          ON fs.subfield_id = s.id
        WHERE s.id = $1
        ORDER BY fs.subfield_index`;
      const { rows }: pg.QueryResult = await pool.query(getSubfieldsQuery, [subfieldId]);
      const subfield: Subfield = {
        id: subfieldId,
        name: rows[0].name,
        index: rows[0].subfield_index
      };
      response.status(200).json(subfield);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addSubfield(request: Request, response: Response): Promise<void> {
    const fieldId = request.params.id;
    const { name }: Subfield = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const subfields = await this.getSubfieldsFromDB(fieldId, client);
      let insertSubfieldQuery = `INSERT INTO subfields (name)
        VALUES ($1) RETURNING *`;
      const { rows }: pg.QueryResult = await client.query(insertSubfieldQuery, [name]);
      let index = 0;
      if (subfields.length > 0) {
        index = subfields[subfields.length-1].index as number + 1;
      }       
      const subfield: Subfield = {
        id: rows[0].id,
        name: rows[0].name,
        index: index
      }
      insertSubfieldQuery = `INSERT INTO fields_subfields (field_id, subfield_index, subfield_id)
        VALUES ($1, $2, $3)`;
      await client.query(insertSubfieldQuery, [fieldId, index, subfield.id]);         
      response.status(200).send(subfield);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateSubfield(request: Request, response: Response): Promise<void> {
    const subfieldId = request.params.id;
    const { name, index }: Subfield = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updateSubfieldQuery = 'UPDATE subfields SET name = $1 WHERE id = $2';
      await client.query(updateSubfieldQuery, [name, subfieldId]);  
      updateSubfieldQuery = 'UPDATE fields_subfields SET subfield_index = $1 WHERE subfield_id = $2';
      await client.query(updateSubfieldQuery, [index, subfieldId]);             
      response.status(200).send(`Subfield modified with ID: ${subfieldId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async deleteSubfield(request: Request, response: Response): Promise<void> {
    const subfieldId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let deleteSubfieldQuery = 'DELETE FROM fields_subfields WHERE subfield_id = $1';
      await client.query(deleteSubfieldQuery, [subfieldId]);
      deleteSubfieldQuery = 'DELETE FROM subfields WHERE id = $1';
      await client.query(deleteSubfieldQuery, [subfieldId]);      
      response.status(200).send(`Subfield deleted with ID: ${subfieldId}`);
      await client.query('COMMIT');
    } catch (error) {
      console.log(error);
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }    
}

