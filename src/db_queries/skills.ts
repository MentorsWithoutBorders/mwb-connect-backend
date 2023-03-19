import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import Skill from '../models/skill.model';
import { constants } from '../utils/constants';

const conn: Conn = new Conn();
const pool = conn.pool;
const helpers: Helpers = new Helpers();

export class Skills {
  constructor() {
    helpers.autoBind(this);
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
    const getSkillsQuery = `SELECT s.id, s.name, ss.skill_index
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
        name: row.name,
        index: row.skill_index
      };
      skills.push(skill);
    }   
    return skills; 
  }

  async getSkillById(request: Request, response: Response): Promise<void> {
    const skillId = request.params.id;
    try {
      const getSkillsQuery = `SELECT s.name, ss.skill_index
        FROM skills s
        JOIN subfields_skills ss
          ON ss.skill_id = s.id
        WHERE s.id = $1
        ORDER BY ss.skill_index`;
      const { rows }: pg.QueryResult = await pool.query(getSkillsQuery, [skillId]);
      const skill: Skill = {
        id: skillId,
        name: rows[0].name,
        index: rows[0].skill_index
      };
      response.status(200).json(skill);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addSkill(request: Request, response: Response): Promise<void> {
    const subfieldId = request.params.id;
    const { name }: Skill = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const skills = await this.getSkillsFromDB(subfieldId, client);
      let insertSkillQuery = `INSERT INTO skills (name)
        VALUES ($1) RETURNING *`;
      const { rows }: pg.QueryResult = await client.query(insertSkillQuery, [name]);
      let index = 0;
      if (skills.length > 0) {
        index = skills[skills.length-1].index as number + 1;
      }       
      const skill: Skill = {
        id: rows[0].id,
        name: rows[0].name,
        index: index
      }
      insertSkillQuery = `INSERT INTO subfields_skills (subfield_id, skill_index, skill_id)
        VALUES ($1, $2, $3)`;
      await client.query(insertSkillQuery, [subfieldId, index, skill.id]);         
      response.status(200).send(skill);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateSkill(request: Request, response: Response): Promise<void> {
    const skillId = request.params.id;
    const { name, index }: Skill = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updateSkillQuery = 'UPDATE skills SET name = $1 WHERE id = $2';
      await client.query(updateSkillQuery, [name, skillId]);  
      updateSkillQuery = 'UPDATE subfields_skills SET skill_index = $1 WHERE skill_id = $2';
      await client.query(updateSkillQuery, [index, skillId]);             
      response.status(200).send(`Skill modified with ID: ${skillId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async deleteSkill(request: Request, response: Response): Promise<void> {
    const skillId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let deleteSkillQuery = 'DELETE FROM subfields_skills WHERE skill_id = $1';
      await client.query(deleteSkillQuery, [skillId]);
      deleteSkillQuery = 'DELETE FROM skills WHERE id = $1';
      await client.query(deleteSkillQuery, [skillId]);      
      response.status(200).send(`Skill deleted with ID: ${skillId}`);
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

