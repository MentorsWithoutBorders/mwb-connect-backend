import { Request, Response } from 'express';
import fs from 'fs';
import pg from 'pg';
import path from 'path';
import moment from 'moment';
import 'moment-timezone';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { QuizzesSettings } from './quizzes_settings';
import { UsersBackgroundProcesses } from './users_background_processes';
import User from '../models/user.model';
import Field from '../models/field.model';
import StudentCertificate from '../models/student_certificate.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const quizzesSettings = new QuizzesSettings();
const usersBackgroundProcesses = new UsersBackgroundProcesses();

export class AdminStudentsCertificates {
  constructor() {
    helpers.autoBind(this);
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
        SET enabled = false, training_reminders_enabled = false WHERE user_id = $1`; 
      await client.query(updateNotificationsSettingsQuery, [studentId]);
      const updateAppFlagsQuery = `UPDATE users_app_flags
        SET is_training_enabled = false WHERE user_id = $1`; 
      await client.query(updateAppFlagsQuery, [studentId]);			
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
	
	async loadPng(pngPath: string): Promise<Uint8Array> {
		return fs.readFileSync(pngPath);
	}

	async customizeCertificatePdf(originalPdfPath: string, newPdfPath: string, imagePath: string) {
		const existingPdfBytes = fs.readFileSync(originalPdfPath);
		const pdfDoc = await PDFDocument.load(existingPdfBytes);
		const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
	
		// Load the image
		const imageData = await this.loadPng(imagePath);
		const image = await pdfDoc.embedPng(imageData);
	
		const pages = pdfDoc.getPages();
		const firstPage = pages[0];
	
		// Image dimensions and position (top right corner)
		const imgHeight = 80;
		const scaleFactor = imgHeight / image.height;
		const imgWidth = image.width * scaleFactor;		
		firstPage.drawImage(image, {
			x: firstPage.getWidth() - imgWidth - 190,
			y: firstPage.getHeight() - imgHeight - 80,
			width: imgWidth,
			height: imgHeight
		});
	
		// Add red text in the middle
		const redText = "Edmond Claudiu Pruteanu";
		const redTextSize = 60;
		const textWidth = timesRomanFont.widthOfTextAtSize(redText, redTextSize);
		console.log('textWidth:', textWidth);
		firstPage.drawText(redText, {
			x: firstPage.getWidth() / 2 - textWidth / 2,
			y: firstPage.getHeight() / 2,
			font: timesRomanFont,
			size: redTextSize,
			color: rgb(1, 0, 0)
		});
	
		// Add black text on the bottom left corner
		const blackText = "Mar 19, 2024";
		firstPage.drawText(blackText, {
			x: 295,
			y: 178,
			size: 16,
			color: rgb(0, 0, 0)
		});
	
		const pdfBytes = await pdfDoc.save();
		fs.writeFileSync(newPdfPath, pdfBytes);
	}

  async createCertificate(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
			const certificateModelPath = path.join('src', 'certificates', 'certificate-model.pdf');
			const certificatePath = path.join('src', 'certificates', 'certificate-Edmond-Pruteanu.pdf'); 
			const imagePath = path.join('src', 'certificates', 'partner-logos', 'Education-for-All-Children.png');
			await this.customizeCertificatePdf(certificateModelPath, certificatePath, imagePath)
			.then(() => console.log('New PDF created successfully with the customizations.'));
      response.status(200).send(`Certificate has been created for user: ${userId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }	
}