import nodemailer from 'nodemailer';
import autoBind from 'auto-bind';
import pg from 'pg';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { Users } from './users';
import { constants } from '../utils/constants';
import Lesson from '../models/lesson.model';
import User from '../models/user.model';

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
      const nextLessonStudents = nextLesson.students;
      if (nextLessonStudents != null && nextLessonStudents.length > 0) {
        const mentor = await users.getUserFromDB(nextLesson.mentor?.id as string, client);
        const students: Array<User> = [];
        for (const nextLessonStudent of nextLessonStudents) {
          const student = await users.getUserFromDB(nextLessonStudent.id as string, client);
          students.push(student);
          this.sendEmailReminderStudent(student, mentor);
        }     
        await this.sendEmailReminderMentor(mentor, students);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async sendEmailReminderMentor(mentor: User, students: Array<User>): Promise<void> {
    const mentorFirstName = mentor?.name?.substring(0, mentor?.name?.indexOf(' '));
    const studentOrStudents = students.length > 1 ? 'students' : 'student';
    const isOrAre = students.length > 1 ? 'are' : 'is';
    const himHerOrThem = students.length > 1 ? 'them' : 'him/her';
    const subject = 'Next lesson in 30 mins';
    let body = `Hi ${mentorFirstName},<br><br>This is a gentle reminder to conduct the next lesson in 30 mins from now.<br>`;
    body += `If the ${studentOrStudents} ${isOrAre}n't able to join the session, you can message ${himHerOrThem} using the following contact details (<b>WhatsApp</b> usually works best):`;
    body += `<ul>`;
    for (const student of students) {
      body += `<li><b>${student.name}</b></li>`;
      body += `<ul>`;
      body += `<li>Email: ${student.email}</li>`;
      body += `<li>WhatsApp number: ${student.phoneNumber}</li>`;
      body += `</ul><br>`;
    }
    body += `</ul>`;
    body += `Regards,<br>MWB Support Team`;
    this.sendEmail(mentor?.email as string, subject, body);    
  }

  async sendEmailReminderStudent(student: User, mentor: User): Promise<void> {
    const studentFirstName = student?.name?.substring(0, student?.name?.indexOf(' '));
    const subject = 'Next lesson in 30 mins';
    let body = `Hi ${studentFirstName},<br><br>This is a gentle reminder to participate in the next lesson in 30 mins from now.<br>`;
    body += `If you aren't able to join the session, please notify your mentor, ${mentor.name}, at: ${mentor.email}<br><br>`;
    body += `Regards,<br>MWB Support Team`;
    this.sendEmail(student?.email as string, subject, body);    
  }  

  sendEmailResetPassword(email: string, id: string): void {
    const subject = 'Password reset request';
    const link = `https://www.mentorswithoutborders.net/reset-password.php?uuid=${id}`;
    const body = `Please use the link below in order to reset your password:<br><br>${link}<br><br>`;
    this.sendEmail(email, subject, body);
  }  
}

