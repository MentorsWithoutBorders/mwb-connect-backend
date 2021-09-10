import nodemailer from 'nodemailer';
import autoBind from 'auto-bind';
import pg from 'pg';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { Users } from './users';
import { constants } from '../utils/constants';
import Lesson from '../models/lesson.model';

const conn: Conn = new Conn();
const users: Users = new Users();
const pool = conn.pool;
dotenv.config();

export class UsersSendEmails {
  constructor() {
    autoBind(this);
  }

  sendEmail(email: string, subject: string, body: string): void {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER as string,
      port: parseInt(process.env.SMTP_PORT as string),
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });
    
    transporter.sendMail({
      to: email,
      from: process.env.SMTP_SENDER,
      subject: subject,
      html: body
    })
      .then(() => console.log(`Email successfully sent: ${email}`))
      .catch(() => console.log(`Email hasn't been sent successfully: ${email}`))    
  }

  async sendEmailLessonReminder(nextLesson: Lesson): Promise<void> {
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const students = nextLesson.students;
      if (students != null && students.length > 0) {
        const mentor = await users.getUserFromDB(nextLesson.mentor?.id as string, client);
        const mentorFirstName = mentor?.name?.substring(0, mentor?.name?.indexOf(' '));
        const studentOrStudents = students.length > 1 ? 'students' : 'student';
        const isOrAre = students.length > 1 ? 'are' : 'is';
        const himHerOrThem = students.length > 1 ? 'them' : 'him/her';
        const subject = 'Next lesson in 30 mins';
        let body = `Hi ${mentorFirstName},<br><br>This is a gentle reminder to conduct the next lesson in 30 mins from now.<br>`;
        body += `If the ${studentOrStudents} ${isOrAre}n't able to join the session, you can message ${himHerOrThem} using the following contact details (<b>WhatsApp</b> usually works best):`;
        body += `<ul>`;
        for (const nextLessonStudent of students) {
          const student = await users.getUserFromDB(nextLessonStudent.id as string, client);
          body += `<li><b>${student.name}</b></li>`;
          body += `<ul>`;
          body += `<li>Email: ${student.email}</li>`;
          body += `<li>WhatsApp number: ${student.phoneNumber}</li>`;
          body += `</ul>`;
        }
        body += `</ul><br>`;
        body += `Regards,<br>MWB Support Team`;
        this.sendEmail(mentor?.email as string, subject, body);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  sendEmailResetPassword(email: string, id: string): void {
    const subject = 'Password reset request';
    const link = `https://www.mentorswithoutborders.net/reset-password.php?uuid=${id}`;
    const body = `Please use the link below in order to reset your password:<br><br>${link}<br><br>`;
    this.sendEmail(email, subject, body);
  }  
}

