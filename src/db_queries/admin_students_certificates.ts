import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { QuizzesSettings } from './quizzes_settings';
import { UsersBackgroundProcesses } from './users_background_processes';
import User from '../models/user.model';
import Field from '../models/field.model';
import StudentCertificate from '../models/student_certificate.model';

const conn = new Conn();
const pool = conn.pool;
const quizzesSettings = new QuizzesSettings();
const usersBackgroundProcesses = new UsersBackgroundProcesses();

export class AdminStudentsCertificates {
  constructor() {
    autoBind(this);
  }

  async getStudentsCertificates(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const getStudentsCertificatesQuery = `SELECT u.id AS student_id, u.name AS student_name, u.email, u.phone_number, u.registered_on, u.field_id, f.name AS field_name, astc.is_certificate_sent, ut.name AS timezone_name
        FROM users u
        JOIN fields f
          ON u.field_id = f.id
        JOIN users_timezones AS ut
          ON u.id = ut.user_id        
        LEFT OUTER JOIN admin_available_users aau
          ON u.id = aau.user_id        
        LEFT OUTER JOIN admin_students_certificates astc
          ON u.id = astc.user_id
        WHERE u.is_mentor IS false
          AND aau.is_inactive IS DISTINCT FROM true
          AND DATE_PART('month', AGE((now() AT TIME ZONE ut.name)::date, (u.registered_on AT TIME ZONE ut.name)::date)) >= 3`;
      const { rows }: pg.QueryResult = await client.query(getStudentsCertificatesQuery);
      const studentsCertificates: Array<StudentCertificate> = [];
      for (const row of rows) {
        const field: Field = {
          id: row.field_id,
          name: row.field_name
        }
        const student: User = {
          id: row.student_id,
          name: row.student_name,
          email: row.email,
          phoneNumber: row.phone_number,
          field: field,
          registeredOn: moment.utc(row.registered_on).format(constants.DATE_TIME_FORMAT)
        }
        const certificateDate = moment.utc(row.registered_on).tz(row.timezone_name).add(3, 'months').format(constants.SHORT_DATE_FORMAT);
        const isTrainingCompleted = await this.getIsTrainingCompleted(student, client);
        const studentCertificate: StudentCertificate = {
          student: student,
          certificateDate: certificateDate,
          isTrainingCompleted: isTrainingCompleted,
          isCertificateSent: row.is_certificate_sent
        }
        studentsCertificates.push(studentCertificate);
      }
      response.status(200).json(studentsCertificates);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getIsTrainingCompleted(student: User, client: pg.PoolClient): Promise<boolean> {
    const isStepAdded = !(await usersBackgroundProcesses.getShowStepReminder(student, client));
    if (!isStepAdded) {
      return false;
    }
    let isCompleted = true;
    const getQuizzesQuery = 'SELECT number, is_correct FROM users_quizzes WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getQuizzesQuery, [student.id]);
    const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB(client);
    const solvedQuizzes: Array<number> = [];
    for (let i = 1; i <= quizSettings.studentWeeklyCount * 4; i++) {
      solvedQuizzes[i] = 0;
    }
    for (const row of rows) {
      if (row.is_correct) {
        solvedQuizzes[row.number]++; 
      }
    }
    for (let i = 1; i <= quizSettings.studentWeeklyCount * 4; i++) {
      if (solvedQuizzes[i] < 2) {
        isCompleted = false;
        break;
      }
    }
    return isCompleted;
  }

  async updateCertificateSent(request: Request, response: Response): Promise<void> {
    const studentId = request.params.student_id;
    const { isCertificateSent }: StudentCertificate = request.body;
    const client = await pool.connect();    
    try {
      const getCertificateSentQuery = 'SELECT id FROM admin_students_certificates WHERE user_id = $1';
      const { rows }: pg.QueryResult = await client.query(getCertificateSentQuery, [studentId]);
      if (rows[0]) {
        const updateCertificateSentQuery = `UPDATE admin_students_certificates
          SET is_certificate_sent = $1 WHERE user_id = $2`;
        const values = [isCertificateSent, studentId];
        await client.query(updateCertificateSentQuery, values);
      } else {
        const insertCertificateSentQuery = `INSERT INTO admin_students_certificates (user_id, is_certificate_sent)
          VALUES ($1, $2)`;
        const values = [studentId, isCertificateSent];
        await client.query(insertCertificateSentQuery, values);    
      }
      const updateNotificationsSettingsQuery = `UPDATE users_notifications_settings
        SET enabled = false WHERE user_id = $1`; 
      await client.query(updateNotificationsSettingsQuery, [studentId]);
      const deleteTrainingReminderQuery = `DELETE FROM admin_training_reminders WHERE user_id = $1`;
      await client.query(deleteTrainingReminderQuery, [studentId]);       
      response.status(200).json(`Certificate sent has been updated for user: ${studentId}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }
  
  async getCertificateSent(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getCertificateSentQuery = 'SELECT is_certificate_sent FROM admin_students_certificates WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getCertificateSentQuery, [userId]);
      const studentCertificate: StudentCertificate = {
        isCertificateSent: false
      };
      if (rows[0]) {
        studentCertificate.isCertificateSent = rows[0].is_certificate_sent;
      }
      response.status(200).json(studentCertificate);
    } catch (error) {
      response.status(400).send(error);
    }
  } 
}