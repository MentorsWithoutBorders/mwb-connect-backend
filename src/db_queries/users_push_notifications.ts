import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import admin from 'firebase-admin';
import serviceAccount from '../../mwb-connect-firebase-adminsdk.json';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { UsersTimeZones } from './users_timezones';
import FCMToken from '../models/fcm_token.model';
import PushNotification from '../models/push_notification.model';
import User from '../models/user.model';
import Course from '../models/course.model';
import CourseMentor from '../models/course_mentor.model';
import CourseStudent from '../models/course_student.model';
import MentorPartnershipRequest from '../models/mentor_partnership_request.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import { PushNotificationType } from '../utils/push_notification_type';

const conn = new Conn();
const helpers = new Helpers();
const usersTimeZones = new UsersTimeZones();
const pool = conn.pool;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  }),
  // databaseURL: 'https://mwb-connect.firebaseio.com'
});
const notificationOptions = {
  priority: "high",
  timeToLive: 60 * 60 * 24
};

export class UsersPushNotifications {
  constructor() {
    helpers.autoBind(this);
  }

  async sendPushNotification(userId: string, pushNotification: PushNotification): Promise<void> {
    const registrationToken = await this.getUserFCMToken(userId);
    if (registrationToken) {
      if (pushNotification.type == null) {
        pushNotification.type = PushNotificationType.Normal
      }
      const payload = {
        notification: {
          title: pushNotification.title,
          body: pushNotification.body
        },
        data: {
          type: pushNotification.type.toString()
        }                
      };
      admin.messaging().sendToDevice(registrationToken, payload, notificationOptions)
      .then()
      .catch(error => {
        console.log(error);
      });
    }
  }  

  async getUserFCMToken(userId: string): Promise<string> {
    const getFCMTokenQuery = 'SELECT fcm_token FROM users_fcm_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getFCMTokenQuery, [userId]);
    return rows[0]?.fcm_token;
  }

  async addFCMToken(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { token }: FCMToken = request.body
    const client = await pool.connect();      
    try {
      await client.query('BEGIN');
      const getFCMTokenQuery = `SELECT user_id FROM users_fcm_tokens WHERE user_id = $1;`;
      const { rows }: pg.QueryResult = await client.query(getFCMTokenQuery, [userId]);
      if (rows && rows.length > 0) {
        const updateFCMTokenQuery = `UPDATE users_fcm_tokens SET fcm_token = $1 WHERE user_id = $2;`;
        const values = [token, userId];
        await client.query(updateFCMTokenQuery, values);
      } else {
        const insertFCMTokenQuery = `INSERT INTO users_fcm_tokens (user_id, fcm_token) VALUES ($1, $2);`;
        const values = [userId, token];
        await client.query(insertFCMTokenQuery, values);
      }
      response.status(200).send('FCM token has been added/updated successfully');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  sendPNFirstTrainingReminder(userId: string, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
    let body = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      body = 'Kindly remember to add a new step to your plan';
    } else if (showStepReminder && showQuizReminder) {
      body = `Kindly remember to add a new step and solve the ${quizzes}`;
    } else if (!showStepReminder && showQuizReminder) {
      body = `Kindly remember to solve the ${quizzes}`;
    }
    const pushNotification: PushNotification = {
      title: 'Training reminder',
      body: body,
      type: PushNotificationType.Normal
    }
    if (showStepReminder || showQuizReminder) {    
      this.sendPushNotification(userId, pushNotification);
    }
  }
  
  getRemainingQuizzesText(remainingQuizzes: number): string {
    let quizzes = '';
    switch(remainingQuizzes) {
      case 1:
        quizzes = 'remaining quiz';
        break;
      case 3:
        quizzes = 'training quizzes';
        break;
      default:
        quizzes = `remaining ${remainingQuizzes} quizzes`;
    }
    return quizzes;    
  }

  sendPNLastTrainingReminder(userId: string, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
    let body = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      body = 'Last day for adding a new step to your plan';
    } else if (showStepReminder && showQuizReminder) {
      body = `Last day for adding a new step and solving the ${quizzes}`;
    } else if (!showStepReminder && showQuizReminder) {
      body = `Last day for solving the ${quizzes}`;
    }
    const pushNotification: PushNotification = {
      title: 'Training reminder',
      body: body,
      type: PushNotificationType.Normal
    }
    if (showStepReminder || showQuizReminder) { 
      this.sendPushNotification(userId, pushNotification);
    }
  }

  sendPNMentorPartnershipRequest(mentorPartnershipRequest: MentorPartnershipRequest): void {
    const mentor = mentorPartnershipRequest.mentor;
    const partnerMentor = mentorPartnershipRequest.partnerMentor;
    const pushNotification: PushNotification = {
      title: 'New mentor partnership request',
      body: `${mentor?.name} is requesting a mentor partnership with you`,
      type: PushNotificationType.Request
    }
    this.sendPushNotification(partnerMentor?.id as string, pushNotification);
  }
	
  sendPNMentorPartnershipRequestAccepted(mentorPartnershipRequest: MentorPartnershipRequest): void {
    const mentor = mentorPartnershipRequest.mentor;
    const partnerMentor = mentorPartnershipRequest.partnerMentor;
    const pushNotification: PushNotification = {
      title: 'Mentor partnership request accepted',
      body: `${partnerMentor?.name} has accepted your partnership request`
    }
    this.sendPushNotification(mentor?.id as string, pushNotification);
  }
	
  sendPNMentorPartnershipRequestRejected(mentorPartnershipRequest: MentorPartnershipRequest): void {
    const mentor = mentorPartnershipRequest.mentor;
    const partnerMentor = mentorPartnershipRequest.partnerMentor;
    const pushNotification: PushNotification = {
      title: 'Mentor partnership request rejected',
      body: `We're sorry but ${partnerMentor?.name} has rejected your partnership request`
    }
    this.sendPushNotification(mentor?.id as string, pushNotification);
  }	

  async sendPNStudentAddedToCourse(student: CourseStudent, course: Course, shouldNotifyOtherStudents: boolean, client: pg.PoolClient): Promise<void> {
    const mentorsSubfields = helpers.getMentorsSubfieldsNames(course.mentors);
    const mentorsNames = helpers.getMentorsNames(course.mentors);
    const pushNotificationStudent: PushNotification = {
      title: 'Added to course',
      body: `You have been added to the ${mentorsSubfields} course with ${mentorsNames}`
    }
    const pushNotificationMentor: PushNotification = {
      title: 'Student added to course',
      body: `${student.name} from ${student.organization?.name} has joined your course`
    }    
    this.sendPushNotification(student.id as string, pushNotificationStudent);
    course?.mentors?.forEach(mentor => {
      this.sendPushNotification(mentor?.id as string, pushNotificationMentor);
    });
		// Send push notification to the other students if the course can start
		if (shouldNotifyOtherStudents && course?.students) {
			await Promise.all(course?.students?.map(async otherStudent => {
				if (otherStudent.id != student.id) {
					const userTimeZone = await usersTimeZones.getUserTimeZone(otherStudent?.id as string, client);
					const courseStartDate = moment.utc(course.startDateTime).tz(userTimeZone.name).format(constants.DATE_FORMAT_LESSON);
					const courseStartTime = moment.utc(course.startDateTime).tz(userTimeZone.name).format(constants.TIME_FORMAT_LESSON);
					const pushNotificationOtherStudents: PushNotification = {
						title: 'Course can start',
						body: `The course will start on ${courseStartDate} at ${courseStartTime} ${userTimeZone.abbreviation}`
					}
					this.sendPushNotification(otherStudent.id as string, pushNotificationOtherStudents);
				}
			})); 
		}
  }

	sendPNCourseCanceled(user: User, course: Course): void {
		if (user.isMentor) {
			this.sendPNCourseCanceledByMentor(user, course);
		} else {
			this.sendPNCourseCanceledByStudent(user, course);
		}		
	}
  
  sendPNCourseCanceledByMentor(mentor: CourseMentor, course: Course): void {
		const partnerMentor = helpers.getPartnerMentor(mentor.id as string, course.mentors as CourseMentor[]);
		if (!partnerMentor) {
			const pushNotificationStudent: PushNotification = {
				title: 'Course cancelled',
				body: `We're sorry but your mentor has cancelled the course`
			}
			course?.students?.forEach(student => {
				this.sendPushNotification(student?.id as string, pushNotificationStudent);
			});			
		} else {
			let title = '';
			let body = '';	
			if (course.students?.length == 0) {
				title = 'Course cancelled';
				body = `We're sorry but your partner has cancelled the course`;
			} else if (course.students && course.students?.length > 0 && !course.hasStarted) {
				title = 'Course reassigned';
				body = `Your partner has cancelled and the course has been reassigned to you`;
			} else if (course.hasStarted) {
				title = 'Lessons reassigned';
				body = `Your partner has cancelled and the remaining lessons have been reassigned to you`;
			}
			const pushNotificationPartnerMentor: PushNotification = {
				title: title,
				body: body
			}    
			this.sendPushNotification(partnerMentor.id as string, pushNotificationPartnerMentor);			
		}			
  }

  sendPNCourseCanceledByStudent(student: CourseStudent, course: Course): void {
		const pushNotification: PushNotification = {
			title: 'Student dropped out of the course',
			body: `${student.name} from ${student.organization?.name} has has dropped out of the course`
		}
		course?.mentors?.forEach(mentor => {
			this.sendPushNotification(mentor?.id as string, pushNotification);
		});		
  }
	
  sendPNNextLessonCanceledByMentor(course: Course): void {
		const pushNotification: PushNotification = {
			title: 'Next lesson cancelled',
			body: `We're sorry but your mentor has cancelled the next lesson`
		}
		course?.students?.forEach(student => {
			this.sendPushNotification(student?.id as string, pushNotification);
		});		
  }

	sendPNNextLessonCanceledByStudent(student: CourseStudent, mentor: CourseMentor): void {
		const pushNotification: PushNotification = {
			title: 'Student cancelled next lesson',
			body: `${student.name} from ${student.organization?.name} won't participate in the next lesson`
		}
		this.sendPushNotification(mentor?.id as string, pushNotification);
  }

	

  sendPNStudentAddedToLesson(student: User, lesson: Lesson): void {
    const mentorName = lesson.mentor?.name;
    const fieldName = student.field?.name?.toLowerCase();
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    const recurring = isLessonRecurrent ? 'recurring ' : '';
    const lessonRecurrence = isLessonRecurrent ? 'lesson recurrence' : 'next lesson';
    const pushNotificationStudent: PushNotification = {
      title: 'Lesson scheduled',
      body: `You have been added to a ${recurring}${fieldName} lesson with ${mentorName}`
    }
    const pushNotificationMentor: PushNotification = {
      title: 'Student added to lesson',
      body: `${student.name} from ${student.organization?.name} has been added to the ${lessonRecurrence}`
    }    
    this.sendPushNotification(student.id as string, pushNotificationStudent);
    this.sendPushNotification(lesson.mentor?.id as string, pushNotificationMentor);
  }    

  sendPNLessonRequest(lessonRequest: LessonRequest): void {
    const mentorId = lessonRequest.mentor?.id;
    const student = lessonRequest.student;
    const subfieldName = lessonRequest.subfield?.name?.toLowerCase();
    const pushNotification: PushNotification = {
      title: 'New lesson request',
      body: `${student?.name} from ${student?.organization?.name} is requesting a ${subfieldName} lesson with you`,
      type: PushNotificationType.Request
    }
    this.sendPushNotification(mentorId as string, pushNotification);
  }

  sendPNLessonRequestReminder(lessonRequest: LessonRequest): void {
    const mentorId = lessonRequest.mentor?.id as string;
    const student = lessonRequest.student as User;    
    const studentFirstName = helpers.getUserFirstName(student);
    const pushNotification: PushNotification = {
      title: 'Lesson request reminder',
      body: `Last day for accepting or rejecting ${studentFirstName}'s lesson request`,
      type: PushNotificationType.Request
    }
    this.sendPushNotification(mentorId, pushNotification);
  }
  
  sendPNLessonRequestAccepted(lesson: Lesson): void {
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    const recurring = isLessonRecurrent ? 'recurring ' : '';
    const mentorName = lesson.mentor?.name;
    const students = lesson.students;
    const student = students != null ? students[0] : {};    
    const fieldName = student.field?.name?.toLowerCase();
    const pushNotification: PushNotification = {
      title: 'Lesson request accepted',
      body: `${mentorName} has scheduled a ${recurring}${fieldName} lesson with you`
    }
    this.sendPushNotification(student.id as string, pushNotification);
  }

  sendPNLessonRequestRejected(lessonRequest: LessonRequest, text: string | undefined): void {
    const mentor = lessonRequest.mentor as User;
    const studentId = lessonRequest.student?.id;    
    const mentorName = mentor?.name;
    let mentorMessage = '';
    if (text) {
      mentorMessage = ` with the following message: "${text}"`;
    }
    const pushNotification: PushNotification = {
      title: 'Lesson request rejected',
      body: `We're sorry but ${mentorName} has rejected your lesson request${mentorMessage}`
    }
    this.sendPushNotification(studentId as string, pushNotification);
  }

  sendPNLessonRequestExpired(lessonRequest: LessonRequest): void {
    const mentor = lessonRequest.mentor as User;
    const studentId = lessonRequest.student?.id;
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const pushNotification: PushNotification = {
      title: 'Lesson request expired',
      body: `We're sorry but your lesson request has expired due to ${mentorFirstName}'s unavailability. Please find a new mentor.`,
      type: PushNotificationType.Request
    }
    this.sendPushNotification(studentId as string, pushNotification);
  }  
  
  sendPNLessonCanceled(lesson: Lesson, student: User, isCancelAll: boolean, lessonsCanceled: number): void {
    const isMentor = lesson.mentor == null ? true : false;
    if (isMentor) { // canceled by mentor
      this.sendPNLessonCanceledStudents(lesson, isCancelAll);
    } else {
      this.sendPNLessonCanceledMentor(lesson, student, isCancelAll, lessonsCanceled);
    }
  }
  
  sendPNLessonCanceledStudents(lesson: Lesson, isCancelAll: boolean): void {
    let title = '';
    let body = '';
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    let message = '';
    if (lesson.reasonCanceled) {
      message = ` with the following message: "${lesson.reasonCanceled}"`;
    }
    if (isLessonRecurrent && isCancelAll) {
      title = 'Lessons recurrence canceled';
      body = `We're sorry but the mentor has canceled the lesson recurrence${message}`;
    } else {
      title = 'Next lesson canceled';
      body = `We're sorry but the mentor has canceled the next lesson${message}`;
    }  
    const pushNotification: PushNotification = {
      title: title,
      body: body
    }    
    if (lesson.students != null) {
      for (const student of lesson.students) {
        this.sendPushNotification(student.id as string, pushNotification);
      }
    }
  }

  sendPNLessonCanceledMentor(lesson: Lesson, student: User, isCancelAll: boolean, lessonsCanceled: number): void {
    let title = '';
    let body = '';
    let message = '';
    let reason = '';
    if (lesson.reasonCanceled) {
      message = ` with the following message: "${lesson.reasonCanceled}"`;
      reason = ` for the following reason: "${lesson.reasonCanceled}"`;
    }    
    if (lessonsCanceled == 0) {
      const studentName = student.name;
      const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
      const lessonRecurrence = isLessonRecurrent && isCancelAll ? 'lesson recurrence' : 'next lesson';
      title = 'Next lesson status';
      body = `${studentName} won't participate in the ${lessonRecurrence}${reason}`;
    } else if (lessonsCanceled == 1) {
      title = 'Next lesson canceled';
      body = `The next lesson has been canceled by the only participant${message}`;
    } else {
      title = 'Next lessons canceled';
      body = `The next ${lessonsCanceled} lessons have been canceled by the only participant${message}`;
    }
    const pushNotification: PushNotification = {
      title: title,
      body: body
    }      
    if (lesson.mentor != null) {    
      this.sendPushNotification(lesson.mentor.id as string, pushNotification);
    }
  }

  sendPNLessonUrlUpdated(students: Array<User>): void {
    const pushNotification: PushNotification = {
      title: 'Lesson link updated',
      body: 'The mentor has updated the lesson link'
    }    
    if (students != null && students.length > 0) {
      for (const student of students) {
        this.sendPushNotification(student.id as string, pushNotification);
      }
    }
  }
  
  sendPNLessonRecurrenceUpdated(students: Array<User>): void {
    const pushNotification: PushNotification = {
      title: 'Lesson recurrence updated',
      body: 'The mentor has updated the lesson recurrence'
    }    
    if (students != null && students.length > 0) {
      for (const student of students) {
        this.sendPushNotification(student.id as string, pushNotification);
      }
    }
  }

  sendPNLessonReminder(nextLesson: Lesson): void {
    const pushNotificationMentor: PushNotification = {
      title: 'Next lesson in 30 mins',
      body: 'Kindly remember to conduct the session',
    }
    const pushNotificationStudent: PushNotification = {
      title: 'Next lesson in 30 mins',
      body: 'Kindly remember to attend the session',
    }
    const mentor = nextLesson.mentor;
    this.sendPushNotification(mentor?.id as string, pushNotificationMentor);
    const students = nextLesson.students;
    if (students != null && students.length > 0) {
      for (const student of students) {
        this.sendPushNotification(student.id as string, pushNotificationStudent);
      }
    }
  }
  
  sendPNFirstAddLessonsReminder(lesson: Lesson): void {
    const students = lesson?.students;
    const studentsText = students?.length == 1 ? 'student' : 'students';
    const pushNotification: PushNotification = {
      title: 'Add more lessons',
      body: `Kindly remember to add more lessons with your previous ${studentsText} if possible`
    }
    const mentor = lesson.mentor;
    this.sendPushNotification(mentor?.id as string, pushNotification);
  }

  sendPNLastAddLessonsReminder(lesson: Lesson): void {
    const students = lesson?.students;
    const studentsText = students?.length == 1 ? 'student' : 'students';
    const pushNotification: PushNotification = {
      title: 'Add more lessons',
      body: `Last day for adding more lessons with your previous ${studentsText}`
    }
    const mentor = lesson.mentor;
    this.sendPushNotification(mentor?.id as string, pushNotification);
  }
  
  sendPNNoMoreLessonsAdded(mentor: User, student: User): void {
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const pushNotification: PushNotification = {
      title: 'No more lessons added',
      body: `We're sorry but ${mentorFirstName} couldn't schedule more lessons. Please find a new mentor.`
    }
    this.sendPushNotification(student.id as string, pushNotification);
  }   
  
  sendPNAfterLesson(lesson: Lesson): void {
    const pushNotification: PushNotification = {
      title: 'Taught today',
      body: 'Please mention briefly what you have taught today',
      type: PushNotificationType.AfterLesson
    }
    const mentor = lesson.mentor;
    this.sendPushNotification(mentor?.id as string, pushNotification);
  }

  async sendPNTest(request: Request, response: Response): Promise<void> {
    try {
      const userId = request.params.user_id;
      const pushNotification: PushNotification = {
        title: 'Test',
        body: 'Test push notification',
      }
      this.sendPushNotification(userId, pushNotification);
      response.status(200).json(`Push notification was sent successfully`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
}

