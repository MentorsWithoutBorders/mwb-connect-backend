import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
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
    try {
      const getQuery = 'SELECT id, name FROM fields ORDER BY id ASC';
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
      JOIN fields_subfields fs
        ON fs.subfield_id = s.id
      WHERE fs.field_id = $1
      ORDER BY fs.subfield_index`;
    const { rows }: pg.QueryResult = await pool.query(getSubfieldsQuery, [fieldId]);
    const subfields: Array<Subfield> = [];
    for (const row of rows) {
      const subfield: Subfield = {
        id: row.id,
        name: row.name,
        skills: await this.getSkills(row.id)
      };
      subfields.push(subfield);
    }
    return subfields;
  }
  
  async getSkills(subfieldId: string): Promise<Array<Skill>> {
    const getSkillsQuery = `SELECT s.id, s.name
      FROM skills s
      JOIN subfields_skills ss
        ON ss.skill_id = s.id
      WHERE ss.subfield_id = $1
      ORDER BY ss.skill_index`;
    const { rows }: pg.QueryResult = await pool.query(getSkillsQuery, [subfieldId]);
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
}

