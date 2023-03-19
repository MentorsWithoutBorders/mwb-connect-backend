import { Request, Response } from 'express';
import moment from 'moment'
import pg from 'pg';
import dotenv from 'dotenv';
import { createClient } from 'async-redis';
import { validate as uuidValidate } from 'uuid';
import { Conn } from '../db/conn';
import { Auth } from './auth';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import User from '../models/user.model';
import Organization from '../models/organization.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Skill from '../models/skill.model';
import Availability from '../models/availability.model';
import AvailabilityTime from '../models/availability_time.model';
import LessonsAvailability from '../models/lessons_availability';
import { ValidationError } from '../utils/errors';

const conn = new Conn();
const pool = conn.pool;
const redisClient = createClient();
const auth = new Auth();
const helpers = new Helpers();
dotenv.config();

export class Users {
  constructor() {
    helpers.autoBind(this);
  }

  async getUsers(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getUsersQuery = 'SELECT id, name, email, field_id, organization_id, is_mentor, is_available, available_from, registered_on FROM users ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getUsersQuery);
      const users: Array<User> = [];
      const server = process.env.SERVER as string;
      for (const row of rows) {
        const userId = row.id;
        const userString = await redisClient.get(`user-${server}-${userId}`);
        if (!userString) {
          const user = await this.getUserFromDB(row.id, client);
          await redisClient.set(`user-${server}-${userId}`, JSON.stringify(user));
          users.push(user);
        } else {
          users.push(JSON.parse(userString));
        }
      }
      response.status(200).json(users);
      await client.query('COMMIT');
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(400).send({message: error.message});
      } else {
        response.status(500).send(error);
      }
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getUser(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const user = await this.getUserFromDB(request.user.id as string, client);
      if (user.isMentor) {
        user.lessonsAvailability = await this.getUserLessonsAvailability(request.user.id as string, client)        
      }
      response.status(200).json(user);
      await client.query('COMMIT');
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(400).send({message: error.message});
      } else {
        response.status(500).send(error);
      }
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getUserFromDB(id: string, client: pg.PoolClient): Promise<User> {
    if (!uuidValidate(id)) {
      throw new ValidationError('Invalid user id');
    }
    const getUserQuery = `SELECT u.id AS user_id, u.name, u.email, u.phone_number, o.id AS organization_id, o.name AS organization_name, f.id AS field_id, f.name AS field_name, u.is_mentor, u.is_available, u.available_from, u.registered_on, ap.is_admin
      FROM users u
      JOIN fields f
        ON u.field_id = f.id
      JOIN organizations o
        ON u.organization_id = o.id
      LEFT OUTER JOIN admin_permissions ap
        ON u.id = ap.user_id
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
      phoneNumber: rows[0].phone_number,
      organization: organization,
      field: field,
      isMentor: rows[0].is_mentor,
      isAvailable: rows[0].is_available,
      availableFrom: moment.utc(rows[0].available_from).format(constants.DATE_TIME_FORMAT),
      availabilities: await this.getUserAvailabilities(id, client),
      registeredOn: moment.utc(rows[0].registered_on).format(constants.DATE_TIME_FORMAT),
      isAdmin: rows[0].is_admin
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
    const getAvailabilitiesQuery = `SELECT utc_time_to,connected_to, id, utc_time_from, utc_day_of_week FROM users_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getAvailabilitiesQuery, [userId]);
    const availabilities: Array<Availability> = [];
    for (const row of rows) {
      let timeTo = row.utc_time_to;
      for (const rowConnectedTo of rows) {
        if (rowConnectedTo.connected_to == row.id) {
          timeTo = rowConnectedTo.utc_time_to;
          break;
        }
      }
      if (!row.connected_to) {
        const time: AvailabilityTime = {
          from: moment(row.utc_time_from, 'HH:mm').format('h:mma'),
          to: moment(timeTo, 'HH:mm').format('h:mma')
        }
        const availability: Availability = {
          dayOfWeek: row.utc_day_of_week,
          time: time
        };
        availabilities.push(availability);
      }
    }
    return availabilities;
  }
  
  async getUserLessonsAvailability(userId: string, client: pg.PoolClient): Promise<LessonsAvailability> {
    const getLessonsAvailabilityQuery = `SELECT min_interval_in_days, min_interval_unit, max_students FROM users_lessons_availabilities
      WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonsAvailabilityQuery, [userId]);
    let minInterval = rows[0].min_interval_in_days;
    switch(rows[0].min_interval_unit) {
      case 'week':
        minInterval /= 7;
        break;
      case 'month':
        minInterval /= 30;
        break;
      case 'year':
        minInterval /= 365;
        break;        
    }
    return {
      minInterval: minInterval,
      minIntervalUnit: rows[0].min_interval_unit,
      maxStudents: rows[0].max_students
    };
  }    

  async updateUser(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { name, email, isMentor, field, isAvailable, availableFrom, availabilities, lessonsAvailability }: User = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updateUserQuery = 'UPDATE users SET name = $1, email = $2, field_id = $3, is_available = $4, available_from = $5 WHERE id = $6';
      const values = [name, email, field?.id, isAvailable, availableFrom, userId];
      await client.query(updateUserQuery, values);
      await this.deleteUserAvailabilities(userId, client);
      await this.insertUserAvailabilities(userId, availabilities as Array<Availability>, client);
      if (isMentor) {
        await this.deleteUserSubfields(userId, client);
        await this.deleteUserSkills(userId, client);
        await this.insertUserSubfields(userId, field?.subfields as Array<Subfield>, client);
        await this.updateUserLessonsAvailability(userId, lessonsAvailability as LessonsAvailability, client);
      }
      const user = await this.getUserFromDB(userId, client);
      const server = process.env.SERVER as string;
      await redisClient.set(`user-${server}-${userId}`, JSON.stringify(user));
      response.status(200).send(userId);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
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
      const insertAvailabilityQuery = `INSERT INTO users_availabilities (user_id, utc_day_of_week, utc_time_from, utc_time_to)
        VALUES ($1, $2, $3, $4) RETURNING id`;
      const timeFrom = moment(availability.time.from, 'h:ma').format('HH:mm');
      let timeTo = moment(availability.time.to, 'h:ma').format('HH:mm');
      let dayOfWeekConnected = null;
      let timeFromConnected = null;
      let timeToConnected = null;
      if (moment(availability.time.to, 'h:ma').isBefore(moment(availability.time.from, 'h:ma'))) {
        timeFromConnected = '00:00';
        timeToConnected = timeTo;
        dayOfWeekConnected = helpers.getNextDayOfWeek(availability.dayOfWeek);
        timeTo = '24:00';
      }
      let values = [userId, availability.dayOfWeek, timeFrom, timeTo];
      const { rows }: pg.QueryResult = await client.query(insertAvailabilityQuery, values);
      const id = rows[0].id;
      if (dayOfWeekConnected && timeToConnected != '00:00') {
        const insertAvailabilityConnectedQuery = `INSERT INTO users_availabilities (user_id, utc_day_of_week, utc_time_from, utc_time_to, connected_to)
          VALUES ($1, $2, $3, $4, $5)`;
        values = [userId, dayOfWeekConnected, timeFromConnected as string, timeToConnected as string, id];
        await client.query(insertAvailabilityConnectedQuery, values);
      }
    }
  }

  async updateUserLessonsAvailability(userId: string, lessonsAvailability: LessonsAvailability, client: pg.PoolClient): Promise<void> {
    const updateLessonsAvailabilityQuery = `UPDATE users_lessons_availabilities 
      SET min_interval_in_days = $1, min_interval_unit = $2, max_students = $3
      WHERE user_id = $4`;
    let minIntervalInDays = lessonsAvailability.minInterval;
    switch(lessonsAvailability.minIntervalUnit) {
      case 'week':
        minIntervalInDays *= 7;
        break;
      case 'month':
        minIntervalInDays *= 30;
        break;
      case 'year':
        minIntervalInDays *= 365;
        break;
    }
    const values = [minIntervalInDays, lessonsAvailability.minIntervalUnit, lessonsAvailability.maxStudents, userId];
    await client.query(updateLessonsAvailabilityQuery, values);
  }  

  async deleteUser(request: Request, response: Response): Promise<void> {
    const id = request.user.id as string;
    const client = await pool.connect();
    const user = await this.getUserFromDB(id, client);
    if (user.isMentor) {
      await this.deleteMentorLessonsDependencies(id, client);
    }
    try {
      await client.query('BEGIN');
      const deleteTimeZoneQuery = 'DELETE FROM users_timezones WHERE user_id = $1';
      await client.query(deleteTimeZoneQuery, [id]);
      const deleteAppFlagsQuery = 'DELETE FROM users_app_flags WHERE user_id = $1';
      await client.query(deleteAppFlagsQuery, [id]);      
      const deleteSupportRequestQuery = 'DELETE FROM users_support_requests WHERE user_id = $1';
      await client.query(deleteSupportRequestQuery, [id]);
      const deleteSubfieldQuery = 'DELETE FROM users_subfields WHERE user_id = $1';
      await client.query(deleteSubfieldQuery, [id]);
      const deleteStepsQuery = 'DELETE FROM users_steps WHERE user_id = $1';
      await client.query(deleteStepsQuery, [id]);
      const deleteSkillsQuery = 'DELETE FROM users_skills WHERE user_id = $1';
      await client.query(deleteSkillsQuery, [id]);
      const deleteRefreshTokenQuery = 'DELETE FROM users_refresh_tokens WHERE user_id = $1';
      await client.query(deleteRefreshTokenQuery, [id]);
      const deleteQuizzesQuery = 'DELETE FROM users_quizzes WHERE user_id = $1';
      await client.query(deleteQuizzesQuery, [id]);
      const deleteNotificationsSettingsQuery = 'DELETE FROM users_notifications_settings WHERE user_id = $1';
      await client.query(deleteNotificationsSettingsQuery, [id]);
      const deleteLessonsStudentQuery = 'DELETE FROM users_lessons_students WHERE student_id = $1';
      await client.query(deleteLessonsStudentQuery, [id]);
      const deleteLessonsNotesQuery = 'DELETE FROM users_lessons_notes WHERE student_id = $1';
      await client.query(deleteLessonsNotesQuery, [id]);
      const deleteLessonsCanceledQuery = 'DELETE FROM users_lessons_canceled WHERE user_id = $1';
      await client.query(deleteLessonsCanceledQuery, [id]);
      const deleteLessonsAvailabilitiesQuery = 'DELETE FROM users_lessons_availabilities WHERE user_id = $1';
      await client.query(deleteLessonsAvailabilitiesQuery, [id]);
      if (user.isMentor) {
        const deleteLessonsQuery = 'DELETE FROM users_lessons WHERE mentor_id = $1';
        await client.query(deleteLessonsQuery, [id]);
        const deleteCoursesMentorsQuery = 'DELETE FROM users_courses_mentors WHERE mentor_id = $1';
        await client.query(deleteCoursesMentorsQuery, [id]);         
        const deleteMentorsWaitingRequestsQuery = 'DELETE FROM mentors_waiting_requests WHERE mentor_id = $1';
        await client.query(deleteMentorsWaitingRequestsQuery, [id]);
        const deleteMentorsPartnershipRequestsQuery = 'DELETE FROM mentors_partnership_requests WHERE mentor_id = $1';
        await client.query(deleteMentorsPartnershipRequestsQuery, [id]);
      }
      const deleteLessonRequestsQuery = 'DELETE FROM users_lesson_requests WHERE mentor_id = $1 OR student_id = $1';
      await client.query(deleteLessonRequestsQuery, [id]);
      const deleteGoalQuery = 'DELETE FROM users_goals WHERE user_id = $1';
      await client.query(deleteGoalQuery, [id]);
      const deleteFCMTokenQuery = 'DELETE FROM users_fcm_tokens WHERE user_id = $1';
      await client.query(deleteFCMTokenQuery, [id]);
      const deleteCertificatePauseQuery = 'DELETE FROM users_certificates_pauses WHERE user_id = $1';
      await client.query(deleteCertificatePauseQuery, [id]);
      const deleteAvailabilitiesQuery = 'DELETE FROM users_availabilities WHERE user_id = $1';
      await client.query(deleteAvailabilitiesQuery, [id]);
      const deleteInAppMessagesQuery = 'DELETE FROM users_in_app_messages WHERE user_id = $1';
      await client.query(deleteInAppMessagesQuery, [id]);      
      const deleteAppVersionQuery = 'DELETE FROM users_app_versions WHERE user_id = $1';
      await client.query(deleteAppVersionQuery, [id]);
      const deleteLoggerQuery = 'DELETE FROM logger WHERE user_id = $1';
      await client.query(deleteLoggerQuery, [id]);
      const deleteAdminAssignedUsersQuery = 'DELETE FROM admin_assigned_users WHERE trainer_id = $1 OR assigned_user_id = $1';
      await client.query(deleteAdminAssignedUsersQuery, [id]);
      const deleteAdminAvailableUsersQuery = 'DELETE FROM admin_available_users WHERE user_id = $1';
      await client.query(deleteAdminAvailableUsersQuery, [id]);
      const deleteAdminConversationsQuery = 'DELETE FROM admin_conversations WHERE user_id = $1';
      await client.query(deleteAdminConversationsQuery, [id]);
      const deleteAdminPermissionsQuery = 'DELETE FROM admin_permissions WHERE user_id = $1';
      await client.query(deleteAdminPermissionsQuery, [id]);
      const deleteAdminStudentsCertificatesQuery = 'DELETE FROM admin_students_certificates WHERE user_id = $1';
      await client.query(deleteAdminStudentsCertificatesQuery, [id]);
      const deleteAdminTrainingRemindersQuery = 'DELETE FROM admin_training_reminders WHERE user_id = $1';
      await client.query(deleteAdminTrainingRemindersQuery, [id]);
      const deleteUserQuery = 'DELETE FROM users WHERE id = $1';
      await client.query(deleteUserQuery, [id]);
      await auth.revokeRefreshToken(id, client);
      response.status(200).send(`User deleted with ID: ${id}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async deleteMentorLessonsDependencies(mentorId: string, client: pg.PoolClient): Promise<void> {
    const getLessonsQuery = `SELECT id FROM users_lessons WHERE mentor_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonsQuery, [mentorId]);
    for (const row of rows) {
      const deleteLessonStudentsQuery = 'DELETE FROM users_lessons_students WHERE lesson_id = $1';
      await client.query(deleteLessonStudentsQuery, [row.id]);
      const deleteLessonCanceledQuery = 'DELETE FROM users_lessons_canceled WHERE lesson_id = $1';
      await client.query(deleteLessonCanceledQuery, [row.id]);      
    }
  }
}

