import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Skill from '../models/skill.model';

const conn = new Conn();
const pool = conn.pool;

export class Fields {
  constructor() {
    autoBind(this);
  }

  async getFields(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const fields = await this.getFieldsFromDB(client);
      response.status(200).json(fields);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getFieldsFromDB(client: pg.PoolClient): Promise<Array<Field>> {
    const getFieldsQuery = 'SELECT id, name, index FROM fields ORDER BY index ASC';
    const { rows }: pg.QueryResult = await client.query(getFieldsQuery);
    const fields: Array<Field> = [];
    for (const row of rows) {
      const field: Field = {
        id: row.id,
        name: row.name,
        index: row.index,
        subfields: await this.getSubfields(row.id, client)
      };
      fields.push(field);
    }
    return fields;
  }

  async getFieldById(request: Request, response: Response): Promise<void> {
    const fieldId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);      
      const field = await this.getFieldByIdFromDB(fieldId, client);
      response.status(200).json(field);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getFieldByIdFromDB(fieldId: string, client: pg.PoolClient): Promise<Field> {
    const getFieldQuery = 'SELECT id, name, index FROM fields WHERE id = $1';
    const { rows }: pg.QueryResult = await client.query(getFieldQuery, [fieldId]);
    const field: Field = {
      id: rows[0].id,
      name: rows[0].name,
      index: rows[0].index,
      subfields: await this.getSubfields(rows[0].id, client)
    };
    return field;   
  }

  async getSubfields(fieldId: string, client: pg.PoolClient): Promise<Array<Subfield>> {
    const getSubfieldsQuery = `SELECT s.id, s.name
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
        skills: await this.getSkills(row.id, client)
      };
      subfields.push(subfield);
    }
    return subfields;
  }
  
  async getSkills(subfieldId: string, client: pg.PoolClient): Promise<Array<Skill>> {
    const getSkillsQuery = `SELECT s.id, s.name
      FROM skills s
      JOIN subfields_skills ss
        ON ss.skill_id = s.id
      WHERE ss.subfield_id = $1
      ORDER BY ss.skill_index`;
    const { rows }: pg.QueryResult = await client.query(getSkillsQuery, [subfieldId]);
    const skills: Array<Skill> = [];
    for (const row of rows) {
      const skill: Skill = {
        id: row.id,
        name: row.name
      };
      skills.push(skill);
    }
    return skills;
  }
  
  async addField(request: Request, response: Response): Promise<void> {
    const { name }: Field = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fields: Array<Field> = await this.getFieldsFromDB(client);
      const insertFieldQuery = `INSERT INTO fields (name, index)
        VALUES ($1, $2) RETURNING *`;
      let index = 0;
      if (fields.length > 0) {
        index = fields[fields.length-1].index as number + 1;
      }
      const values = [name, index];        
      const { rows }: pg.QueryResult = await client.query(insertFieldQuery, values);
      const field: Field = {
        id: rows[0].id,
        name: rows[0].name,
        index: rows[0].index
      }  
      response.status(200).send(field);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateField(request: Request, response: Response): Promise<void> {
    const fieldId = request.params.id;
    const { name, index }: Field = request.body;
    try {
      const updateFieldQuery = 'UPDATE fields SET name = $1, index = $2 WHERE id = $3';
      await pool.query(updateFieldQuery, [name, index, fieldId]);
      response.status(200).send(`Field modified with ID: ${fieldId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteField(request: Request, response: Response): Promise<void> {
    const fieldId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteFieldQuery = 'DELETE FROM fields WHERE id = $1';
      await client.query(deleteFieldQuery, [fieldId]);
      response.status(200).send(`Field deleted with ID: ${fieldId}`);
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

