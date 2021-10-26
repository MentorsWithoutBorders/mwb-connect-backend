import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { constants } from '../utils/constants';
import { Conn } from '../db/conn';
import { Users } from './users';
import { Skills } from './skills';
import Skill from '../models/skill.model';
import Ids from '../models/ids.model';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();
const skillsQueries = new Skills();

export class UsersSkills {
  constructor() {
    autoBind(this);
  }

  async getUserSkills(request: Request, response: Response): Promise<void> {
    const userId = request.params.user_id;
    const subfieldId = request.params.subfield_id;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const skills: Array<Skill> = await users.getUserSkills(userId, subfieldId, client);
      response.status(200).json(skills);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async addUserSkills(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const subfieldId = request.params.id;
    const { listIds }: Ids = request.body;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const skills = listIds;
      // if (!skills) {
      //   skills = [];
      // }
      await this.addUserSkillsToDB(userId, subfieldId, skills, client);
      response.status(200).send('User skills have been added');
      await client.query('COMMIT');
    } catch (error) {
      console.log(error)
      response.status(400).send(error);
      await client.query('ROLLBACK');
      console.log("rolled back");
    } finally {
      client.release();
    }  
  }

  async addUserSkillsToDB(userId: string, subfieldId: string, skills: Array<string>, client: pg.PoolClient): Promise<void> {
    const currentSkills = await users.getUserSkills(userId, subfieldId, client);
    const subfieldSkills = await skillsQueries.getSkillsFromDB(subfieldId, client);
    const skillsToAdd: Array<Skill> = [];
    for (const subfieldSkill of subfieldSkills) {
      if (currentSkills.some(currentSkill => currentSkill.id === subfieldSkill.id) ||
          skills.some(skill => skill === subfieldSkill.id)) {
        skillsToAdd.push(subfieldSkill);
      }
    }
    await this.deleteSkills(userId, client);
    for (let i = 1; i <= skillsToAdd.length; i++) {
      skillsToAdd[i-1].index = i;
      await this.addSkillToDB(userId, subfieldId, skillsToAdd[i-1], client);
    }    
  }

  async deleteSkills(userId: string, client: pg.PoolClient): Promise<void> {
    const deleteSkillsQuery = 'DELETE FROM users_skills WHERE user_id = $1';
    await client.query(deleteSkillsQuery, [userId]);
  }    

  async addSkillToDB(userId: string, subfieldId: string, skill: Skill, client: pg.PoolClient): Promise<void> {
    const insertSkillQuery = `INSERT INTO users_skills (user_id, subfield_id, skill_index, skill_id)
      VALUES ($1, $2, $3, $4)`;
    const values = [userId, subfieldId, skill.index, skill.id];        
    await client.query(insertSkillQuery, values); 
  }
}

