import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment'
import pg from 'pg';
import { validate as uuidValidate } from 'uuid';
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
import { ValidationError } from '../utils/errors';

const conn: Conn = new Conn();
const pool = conn.pool;
const auth: Auth = new Auth();

export class Users {
  constructor() {
    autoBind(this);
  }

  async getUsers(request: Request, response: Response): Promise<void> {
    try {
      const getUsersQuery = 'SELECT id, name, email, field_id, organization_id, is_mentor, is_available, available_from, registered_on FROM users ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getUsersQuery);
      response.status(200).json(rows);
    } catch (error) {
      response.status(500).send(error);
    }
  }

  async getUser(request: Request, response: Response): Promise<void> {
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);
      const user: User = await this.getUserFromDB(request.user.id as string, client);
      if (user.isMentor) {
        user.lessonsAvailability = await this.getUserLessonsAvailability(request.user.id as string, client)        
      }
      response.status(200).json(user);
      await client.query("COMMIT");
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(400).send({message: error.message});
      } else {
        response.status(500).send(error);
      }
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getUserFromDB(id: string, client: pg.PoolClient): Promise<User> {
    if (!uuidValidate(id)) {
      throw new ValidationError('Invalid user id');
    }
    const getUserQuery = `SELECT u.id AS user_id, u.name, u.email, o.id AS organization_id, o.name AS organization_name, f.id AS field_id, f.name AS field_name, u.is_mentor, u.is_available, u.available_from, u.registered_on
      FROM users u
      JOIN fields f
      ON u.field_id = f.id
      JOIN organizations o
      ON u.organization_id = o.id
      WHERE u.id = $1`;
    const { rows }: pg.QueryResult = await client.query(getUserQuery, [id]);
    if (rows.length === 0) {
      throw new ValidationError('User not found');
    }
    const organization: Organization = {
      id: rows[0].organization_id,
      name: rows[0].organization_name
    };    
    const field: Field = {
      id: rows[0].field_id,
      name: rows[0].field_name,
      subfields: await this.getUserSubfields(id, client)
    };
    return {
      id: rows[0].user_id,
      name: rows[0].name,
      email: rows[0].email,
      organization: organization,
      field: field,
      isMentor: rows[0].is_mentor,
      isAvailable: rows[0].is_available,
      availableFrom: moment.utc(rows[0].available_from).format(constants.DATE_TIME_FORMAT),
      availabilities: await this.getUserAvailabilities(id, client),
      registeredOn: moment.utc(rows[0].available_from).format(constants.DATE_TIME_FORMAT)
    }
  }

  async getUserSubfields(userId: string, client: pg.PoolClient): Promise<Array<Subfield>> {
    const getSubfieldsQuery = `SELECT s.id, s.name
      FROM subfields s
      JOIN users_subfields us
      ON us.subfield_id = s.id
      WHERE us.user_id = $1
      ORDER BY us.subfield_index ASC`;
    const { rows }: pg.QueryResult = await client.query(getSubfieldsQuery, [userId]);
    const subfields: Array<Subfield> = [];
    for (const row of rows) {
      const skills: Array<Skill> = await this.getUserSkills(userId, row.id, client);
      const subfield: Subfield = {
        id: row.id,
        name: row.name,
        skills: skills
      };
      subfields.push(subfield);
    }
    return subfields;    
  }

  async getUserSkills(userId: string, subfieldId: string, client: pg.PoolClient): Promise<Array<Skill>> {
    const getSkillsQuery = `SELECT s.id, s.name
      FROM skills s
      JOIN users_skills us
      ON us.skill_id = s.id
      WHERE us.user_id = $1 AND us.subfield_id = $2
      ORDER BY us.skill_index ASC`;
    const { rows }: pg.QueryResult = await client.query(getSkillsQuery, [userId, subfieldId]);
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
  
  async getUserAvailabilities(userId: string, client: pg.PoolClient): Promise<Array<Availability>> {
    const getAvailabilitiesQuery = `SELECT * FROM users_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getAvailabilitiesQuery, [userId]);
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
  
  async getUserLessonsAvailability(userId: string, client: pg.PoolClient): Promise<LessonsAvailability> {
    const getLessonsAvailabilityQuery = `SELECT * FROM users_lessons_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonsAvailabilityQuery, [userId]);
    return {
      minInterval: rows[0].min_interval,
      minIntervalUnit: rows[0].min_interval_unit,
      maxStudents: rows[0].max_students
    };
  }    

  async updateUser(request: Request, response: Response): Promise<void> {
    const id: string = request.user.id as string;
    const { name, email, field, isAvailable, availableFrom, availabilities, lessonsAvailability }: User = request.body
    const values = [name, email, field?.id, isAvailable, availableFrom, id];
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateUserQuery = 'UPDATE users SET name = $1, email = $2, field_id = $3, is_available = $4, available_from = $5 WHERE id = $6';
      await client.query(updateUserQuery, values);
      await this.deleteUserSubfields(id, client);
      await this.deleteUserSkills(id, client);
      await this.deleteUserAvailabilities(id, client);      
      await this.insertUserSubfields(id, field?.subfields as Array<Subfield>, client);
      await this.insertUserAvailabilities(id, availabilities as Array<Availability>, client);
      await this.updateUserLessonsAvailability(id, lessonsAvailability as LessonsAvailability, client);
      response.status(200).send(id);
      await client.query("COMMIT");
    } catch (error) {
      response.status(500).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async deleteUserSubfields(userId: string, client: pg.PoolClient): Promise<void> {
    const deleteSubfieldsQuery = `DELETE FROM users_subfields
      WHERE user_id = $1`;
    await client.query(deleteSubfieldsQuery, [userId]);
  }

  async deleteUserSkills(userId: string, client: pg.PoolClient): Promise<void> {
    const deleteSkillsQuery = `DELETE FROM users_skills
      WHERE user_id = $1`;
    await client.query(deleteSkillsQuery, [userId]);    
  }

  async deleteUserAvailabilities(userId: string, client: pg.PoolClient): Promise<void> {
    const deleteAvailabilitiesQuery = `DELETE FROM users_availabilities
      WHERE user_id = $1`;
    await client.query(deleteAvailabilitiesQuery, [userId]);    
  }  

  async insertUserSubfields(userId: string, subfields: Array<Subfield>, client: pg.PoolClient): Promise<void> {
    for (let i = 0; i < subfields.length; i++) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_index, subfield_id)
        VALUES ($1, $2, $3)`;
      await client.query(insertSubfieldQuery, [userId, i+1, subfields[i].id]); 
      if (subfields[i].skills != null && (subfields[i].skills as Array<Skill>).length > 0) {
        await this.updateUserSkills(userId, subfields[i].id as string, subfields[i].skills as Array<Skill>, client);
      }
    }
  }
  
  async updateUserSkills(userId: string, subfieldId: string, skills: Array<Skill>, client: pg.PoolClient): Promise<void> {
    for (let i = 0; i < skills.length; i++) {
      const insertSkillQuery = `INSERT INTO users_skills (user_id, subfield_id, skill_index, skill_id)
        VALUES ($1, $2, $3, $4)`;
      const values = [userId, subfieldId, i+1, skills[i].id];
      await client.query(insertSkillQuery, values);
    }
  }
  
  async insertUserAvailabilities(userId: string, availabilities: Array<Availability>, client: pg.PoolClient): Promise<void> {
    for (const availability of availabilities) {
      const insertAvailabilityQuery = `INSERT INTO users_availabilities (user_id, day_of_week, time_from, time_to)
        VALUES ($1, $2, $3, $4)`;
      const timeFrom = moment(availability.time.from, 'ha').format('HH:mm');
      const timeto = moment(availability.time.to, 'ha').format('HH:mm');
      const values = [userId, availability.dayOfWeek, timeFrom, timeto];
      await client.query(insertAvailabilityQuery, values);
    }
  }

  async updateUserLessonsAvailability(userId: string, lessonsAvailability: LessonsAvailability, client: pg.PoolClient): Promise<void> {
    const updateLessonsAvailabilityQuery = `UPDATE users_lessons_availabilities 
      SET min_interval = $1, min_interval_unit = $2, max_students = $3
      WHERE user_id = $4`;
    const values = [lessonsAvailability.minInterval, lessonsAvailability.minIntervalUnit, lessonsAvailability.maxStudents, userId];
    await client.query(updateLessonsAvailabilityQuery, values);
  }  

  async deleteUser(request: Request, response: Response): Promise<void> {
    const id: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const deleteQuery = 'DELETE FROM users WHERE id = $1';
      await client.query(deleteQuery, [id]);
      await auth.revokeRefreshToken(id, client);
      response.status(200).send(`User deleted with ID: ${id}`);
      await client.query("COMMIT");
    } catch (error) {
      response.status(400).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}

