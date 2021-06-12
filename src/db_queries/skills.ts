import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Skill from '../models/skill.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Skills {
  constructor() {
    autoBind(this);
  }

  async getSkills(request: Request, response: Response): Promise<void> {
    const subfieldId: string = request.params.id;
    try {
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
      response.status(200).json(skills);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}

