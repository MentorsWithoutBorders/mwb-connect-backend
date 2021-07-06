import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { Users } from './users';
import { Skills } from './skills';
import Skill from '../models/skill.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const skillsQueries: Skills = new Skills();

export class UsersSkills {
  constructor() {
    autoBind(this);
  }

  async getUserSkills(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const subfieldId: string = request.params.id;
    try {
      const skills: Array<Skill> = await users.getUserSkills(userId, subfieldId);
      response.status(200).json(skills);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async addUserSkills(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const subfieldId: string = request.params.id;
    const skills = request.body;
    try {
      await this.addUserSkillsToDB(userId, subfieldId, skills);
      response.status(200).send('User skills have been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addUserSkillsToDB(userId: string, subfieldId: string, skills: Array<string>): Promise<void> {
    const currentSkills = await users.getUserSkills(userId, subfieldId);
    const subfieldSkills = await skillsQueries.getSkillsFromDB(subfieldId);
    const skillsToAdd: Array<Skill> = [];
    for (const subfieldSkill of subfieldSkills) {
      if (currentSkills.some(currentSkill => currentSkill.id === subfieldSkill.id) ||
          skills.some(skill => skill === subfieldSkill.id)) {
        skillsToAdd.push(subfieldSkill);
      }
    }
    await this.deleteSkills(userId);
    for (let i = 1; i <= skillsToAdd.length; i++) {
      skillsToAdd[i-1].index = i;
      await this.addSkillToDB(userId, subfieldId, skillsToAdd[i-1]);
    }    
  }

  async deleteSkills(userId: string): Promise<void> {
    const deleteSkillsQuery = 'DELETE FROM users_skills WHERE user_id = $1';
    await pool.query(deleteSkillsQuery, [userId]);
  }    

  async addSkillToDB(userId: string, subfieldId: string, skill: Skill): Promise<void> {
    const insertSkillQuery = `INSERT INTO users_skills (user_id, subfield_id, skill_index, skill_id)
      VALUES ($1, $2, $3, $4)`;
    const values = [userId, subfieldId, skill.index, skill.id];        
    await pool.query(insertSkillQuery, values); 
  }
}

