import { Request, Response } from 'express';
import fs from 'fs';
import pg from 'pg';
import path from 'path';
import moment from 'moment';
import 'moment-timezone';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, Color } from 'pdf-lib';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersCourses } from './users_courses';
import { QuizzesSettings } from './quizzes_settings';
import { UsersBackgroundProcesses } from './users_background_processes';
import User from '../models/user.model';
import Field from '../models/field.model';
import StudentCertificate from '../models/student_certificate.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersCourses = new UsersCourses();
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

	async customizeCertificatePdf(originalPdfPath: string, newPdfPath: string, mwbLogoPath: string, orgLogoPath: string, studentName: string, studentSubfields: Array<string>) {
    const existingPdfBytes = fs.readFileSync(originalPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Load the MWB logo
    const mwbLogoData = await this.loadPng(mwbLogoPath); // Make sure to implement loadPng method for mwbLogoPath
    const mwbLogo = await pdfDoc.embedPng(mwbLogoData);		

    // Load the organization logo
    const orgLogoData = await this.loadPng(orgLogoPath);
    const orgLogo = await pdfDoc.embedPng(orgLogoData);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // MWB logo dimensions and position (top left corner)
    const mwbLogoHeight = 90;
    const scaleFactorMwb = mwbLogoHeight / mwbLogo.height;
    const mwbLogoWidth = mwbLogo.width * scaleFactorMwb;
    firstPage.drawImage(mwbLogo, {
        x: 170, 
        y: firstPage.getHeight() - mwbLogoHeight - 85,
        width: mwbLogoWidth,
        height: mwbLogoHeight
    });		

    // Organization logo dimensions and position (top right corner)
    const orgLogoHeight = 80;
    const scaleFactor = orgLogoHeight / orgLogo.height;
    const orgLogoWidth = orgLogo.width * scaleFactor;      
    firstPage.drawImage(orgLogo, {
			x: firstPage.getWidth() - orgLogoWidth - 190,
			y: firstPage.getHeight() - orgLogoHeight - 80,
			width: orgLogoWidth,
			height: orgLogoHeight
    });
		
		studentName = studentName.replace(/-/g, ' ');
    const studentNameSize = 60;		

    // Calculate position for the awarded text
		const awardedToText = "This certificate is awarded to";
		const awardedToTextSize = 18;
		const awardedToTextSpacing = 2;
		const awardedToTextWidth =
			helveticaFont.widthOfTextAtSize(awardedToText, awardedToTextSize) +
			(awardedToText.length - 1) * awardedToTextSpacing;
		const awardedToTextYPosition = firstPage.getHeight() / 2 + studentNameSize / 2 + 50;
		
		// Calculate starting position for the new text to be centered
		const awardedToTextXPosition = firstPage.getWidth() / 2 - awardedToTextWidth / 2;
		
		// Use the custom function to draw the new text with spacing
		this.drawTextWithSpacing(
			firstPage,
			awardedToText,
			awardedToTextXPosition,
			awardedToTextYPosition,
			awardedToTextSpacing,
			helveticaFont,
			awardedToTextSize,
			rgb(0, 0, 0) // Correct use of rgb function to create a Color
		);

    // Add student name in the middle
    const studentNameWidth = helveticaFont.widthOfTextAtSize(studentName, studentNameSize);
    const studentNameYPosition = awardedToTextYPosition - awardedToTextSize - 60;
    firstPage.drawText(studentName, {
			x: firstPage.getWidth() / 2 - studentNameWidth / 2,
			y: studentNameYPosition,
			font: helveticaFont,
			size: studentNameSize,
			color: rgb(0.9686, 0.3451, 0.1804)
    });

    // Calculate the starting Y position for the subfields text
    const subfieldsStartYPosition = studentNameYPosition - studentNameSize;

    // Add customized text for student subfields
    let subfieldsText = 'for having completed the 3-month MWB ';
    if (studentSubfields.length > 1) {
      subfieldsText += studentSubfields.join(' and ');
    } else if (studentSubfields.length === 1) {
      subfieldsText += studentSubfields[0];
    }
    subfieldsText += ' course.';

    // Assuming a function to split text into lines based on width and font size
    const { lines, fontSize } = await this.splitSubfieldsTextToFitWidth(subfieldsText, helveticaFont, firstPage.getWidth() - 350);

    lines.forEach((line: string, index: number) => {
			const textWidth = helveticaFont.widthOfTextAtSize(line, fontSize);
			firstPage.drawText(line, {
				x: (firstPage.getWidth() / 2) - (textWidth / 2),
				y: subfieldsStartYPosition - (index * (fontSize + 10)),
				size: fontSize,
				font: helveticaFont,
				color: rgb(0, 0, 0)
			});
    });      

    // Add current date on the bottom left corner
    const currentDate = moment().format('MMM DD, YYYY');
    firstPage.drawText(currentDate, {
			x: 295,
			y: 178,
			size: 16,
			color: rgb(0, 0, 0)
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(newPdfPath, pdfBytes);
	}

	async splitSubfieldsTextToFitWidth(text: string, font: PDFFont, maxWidth: number): Promise<{ lines: string[], fontSize: number }> {
		let fontSize = 20;
		let lines = [text];
		const isTextTooWide = () => font.widthOfTextAtSize(lines[lines.length - 1], fontSize) > maxWidth;
	
		while (fontSize > 10 && isTextTooWide()) {
			fontSize -= 1;
			const words = text.split(' ');
			lines = [];
			let currentLine = words.shift() || '';
	
			words.forEach((word) => {
				const testLine = `${currentLine} ${word}`;
				if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
					currentLine = testLine;
				} else {
					lines.push(currentLine);
					currentLine = word;
				}
			});
	
			lines.push(currentLine);
		}
	
		return { lines, fontSize };
	}

	drawTextWithSpacing(
		page: PDFPage,
		text: string,
		startPosition: number,
		yPosition: number,
		spacing: number,
		font: PDFFont,
		fontSize: number,
		color: Color
	): void {
		let currentPosition: number = startPosition;
		for (let i = 0; i < text.length; i++) {
			const letter: string = text[i];
			page.drawText(letter, {
				x: currentPosition,
				y: yPosition,
				font: font,
				size: fontSize,
				color: color,
			});
			// Move the currentPosition for the next letter by the width of the current letter plus spacing
			if (i < text.length - 1) {
				currentPosition += font.widthOfTextAtSize(letter, fontSize) + spacing;
			}
		}
	}

  async createCertificate(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
		const { id }: User = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
			const student = await users.getUserFromDB(id as string, client);
			const certificateModelPath = path.join('src', 'certificates', 'certificate-model.pdf');
			const studentName = student?.name?.replace(/\s/g, '-') || '';
			const certificatePath = path.join('src', 'certificates', `certificate-${studentName}.pdf`);
			const studentOrganizationName = student?.organization?.name?.replace(/\s/g, '-');
			const studentSubfields = await usersCourses.getAttendedCoursesSubfieldsByStudentId(id as string);
			const mwbLogoPath = path.join('src', 'certificates', 'partner-logos', `MWB.png`);
			const orgLogoPath = path.join('src', 'certificates', 'partner-logos', `${studentOrganizationName}.png`);
			await this.customizeCertificatePdf(certificateModelPath, certificatePath, mwbLogoPath, orgLogoPath, studentName, studentSubfields)
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