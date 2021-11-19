import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Skill from '../models/skill.model';
import { constants } from '../utils/constants';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Skills {
  constructor() {
    autoBind(this);
  }

  async getSkills(request: Request, response: Response): Promise<void> {
    const subfieldId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const skills = await this.getSkillsFromDB(subfieldId, client);
      response.status(200).send(skills);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getSkillsFromDB(subfieldId: string, client: pg.PoolClient): Promise<Array<Skill>> {
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
}

