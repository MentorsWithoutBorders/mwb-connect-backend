import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment'
import pg from 'pg';
import { Conn } from '../db/conn';
import { Auth } from './auth';
import { constants } from '../utils/constants';
import User from '../models/user.model';
import Organization from '../models/organization.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Skill from '../models/skill.model';
import Availability from '../models/availability.model';
import Time from '../models/time.model';
import LessonsAvailability from '../models/lessons_availability';

const conn: Conn = new Conn();
const pool = conn.pool;
const auth: Auth = new Auth();

export class Users {
  constructor() {
    autoBind(this);
  }

  async getUsers(request: Request, response: Response): Promise<void> {
    try {
      const getUsersQuery = 'SELECT * FROM users ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getUsersQuery);
      response.status(200).json(rows);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getUserById(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const user: User = await this.getUserFromDB(id);
      if (user.isMentor) {
        user.lessonsAvailability = await this.getUserLessonsAvailability(id)        
      }

      response.status(200).json(user);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getUserFromDB(id: string): Promise<User> {
    const getUserQuery = `SELECT u.id, u.name, u.email, o.name AS organization, f.id AS field_id, f.name AS field_name, u.is_mentor, u.is_available, u.available_from
      FROM users u
      JOIN fields f
      ON u.field_id = f.id
      JOIN organizations o
      ON u.organization_id = o.id
      WHERE u.id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [id]);
    const organization: Organization = {
      name: rows[0].organization
    };    
    const field: Field = {
      id: rows[0].field_id,
      name: rows[0].field_name,
      subfields: await this.getUserSubfields(id)
    };
    return {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      organization: organization,
      field: field,
      isMentor: rows[0].is_mentor,
      isAvailable: rows[0].is_available,
      availableFrom: moment(rows[0].available_from).format(constants.DATE_FORMAT),
      availabilities: await this.getUserAvailabilities(id),
      registeredOn: moment(rows[0].available_from).format(constants.DATE_FORMAT)
    }
  }

  async getUserSubfields(userId: string): Promise<Array<Subfield>> {
    const getSubfieldsQuery = `SELECT s.id, s.name
      FROM subfields s
      JOIN users_subfields us
      ON us.subfield_id = s.id
      WHERE us.user_id = $1
      ORDER BY us.subfield_index ASC`;
    const { rows }: pg.QueryResult = await pool.query(getSubfieldsQuery, [userId]);
    const subfields: Array<Subfield> = [];
    for (const row of rows) {
      const skills: Array<Skill> = await this.getUserSkills(userId, row.id);
      const subfield: Subfield = {
        id: row.id,
        name: row.name,
        skills: skills
      };
      subfields.push(subfield);
    }
    return subfields;    
  }

  async getUserSkills(userId: string, subfieldId: string): Promise<Array<Skill>> {
    const getSkillsQuery = `SELECT s.id, s.name
      FROM skills s
      JOIN users_skills us
      ON us.skill_id = s.id
      WHERE us.user_id = $1 AND us.subfield_id = $2
      ORDER BY us.skill_index ASC`;
    const { rows }: pg.QueryResult = await pool.query(getSkillsQuery , [userId, subfieldId]);
    const skills: Array<Skill> = [];
    rows.forEach(function (row) {
      const skill: Skill = {
        id: row.id,
        name: row.name
      };
      skills.push(skill);
    });
    return skills;    
  }
  
  async getUserAvailabilities(userId: string): Promise<Array<Availability>> {
    const getAvailabilitiesQuery = `SELECT * FROM users_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getAvailabilitiesQuery, [userId]);
    const availabilities: Array<Availability> = [];
    for (const row of rows) {
      const time: Time = {
        from: moment(row.time_from, 'HH:mm').format('ha'),
        to: moment(row.time_to, 'HH:mm').format('ha')
      }
      const availability: Availability = {
        dayOfWeek: row.day_of_week,
        time: time
      };
      availabilities.push(availability);
    }
    return availabilities;
  }
  
  async getUserLessonsAvailability(userId: string): Promise<LessonsAvailability> {
    const getLessonsAvailabilityQuery = `SELECT * FROM users_lessons_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getLessonsAvailabilityQuery, [userId]);
    return {
      minInterval: rows[0].min_interval,
      minIntervalUnit: rows[0].min_interval_unit
    };
  }    

  async updateUser(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    const { name, email, field, isAvailable, availableFrom, availabilities, lessonsAvailability }: User = request.body
    try {
      const updateUserQuery = 'UPDATE users SET name = $1, email = $2, field_id = $3, is_available = $4, available_from = $5 WHERE id = $6';
      const values = [name, email, field?.id, isAvailable, availableFrom, id];
      await pool.query(updateUserQuery, values);
      await this.deleteUserSubfields(id);
      await this.deleteUserSkills(id);
      await this.deleteUserAvailabilities(id);      
      await this.insertUserSubfields(id, field?.subfields as Array<Subfield>);
      await this.insertUserAvailabilities(id, availabilities as Array<Availability>);
      await this.updateUserLessonsAvailability(id, lessonsAvailability as LessonsAvailability);
      response.status(200).send(`User modified with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteUserSubfields(userId: string): Promise<void> {
    const deleteSubfieldsQuery = `DELETE FROM users_subfields
      WHERE user_id = $1`;
    await pool.query(deleteSubfieldsQuery, [userId]);
  }

  async deleteUserSkills(userId: string): Promise<void> {
    const deleteSkillsQuery = `DELETE FROM users_skills
      WHERE user_id = $1`;
    await pool.query(deleteSkillsQuery, [userId]);    
  }
  
  async deleteUserAvailabilities(userId: string): Promise<void> {
    const deleteAvailabilitiesQuery = `DELETE FROM users_availabilities
      WHERE user_id = $1`;
    await pool.query(deleteAvailabilitiesQuery, [userId]);    
  }  

  async insertUserSubfields(userId: string, subfields: Array<Subfield>): Promise<void> {
    for (let i = 0; i < subfields.length; i++) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_index, subfield_id)
        VALUES ($1, $2, $3)`;
      await pool.query(insertSubfieldQuery, [userId, i+1, subfields[i].id]); 
      if (subfields[i].skills != null && (subfields[i].skills as Array<Skill>).length > 0) {
        await this.updateUserSkills(userId, subfields[i].id, subfields[i].skills as Array<Skill>);
      }
    }
  }
  
  async updateUserSkills(userId: string, subfieldId: string, skills: Array<Skill>): Promise<void> {
    for (let i = 0; i < skills.length; i++) {
      const insertSkillQuery = `INSERT INTO users_skills (user_id, subfield_id, skill_index, skill_id)
        VALUES ($1, $2, $3, $4)`;
      const values = [userId, subfieldId, i+1, skills[i].id];
      await pool.query(insertSkillQuery, values);
    }
  }
  
  async insertUserAvailabilities(userId: string, availabilities: Array<Availability>): Promise<void> {
    for (let availability of availabilities) {
      const insertAvailabilityQuery = `INSERT INTO users_availabilities (user_id, day_of_week, time_from, time_to)
        VALUES ($1, $2, $3, $4)`;
      const timeFrom = moment(availability.time.from, 'ha').format('HH:mm');
      const timeto = moment(availability.time.to, 'ha').format('HH:mm');
      const values = [userId, availability.dayOfWeek, timeFrom, timeto];
      await pool.query(insertAvailabilityQuery, values);
    }
  }

  async updateUserLessonsAvailability(userId: string, lessonsAvailability: LessonsAvailability): Promise<void> {
    const updateLessonsAvailabilityQuery = `UPDATE users_lessons_availabilities 
      SET min_interval = $1, min_interval_unit = $2
      WHERE user_id = $3`;
    const values = [lessonsAvailability.minInterval, lessonsAvailability.minIntervalUnit, userId];
    await pool.query(updateLessonsAvailabilityQuery, values);
  }  

  async deleteUser(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const deleteQuery = 'DELETE FROM users WHERE id = $1';
      await pool.query(deleteQuery, [id]);
      await auth.revokeRefreshToken(id);
      response.status(200).send(`User deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }
}

