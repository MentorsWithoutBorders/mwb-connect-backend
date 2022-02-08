import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import admin from 'firebase-admin';
import serviceAccount from '../../mwb-connect-firebase-adminsdk.json';
import { Conn } from '../db/conn';
import FCMToken from '../models/fcm_token.model';
import PushNotification from '../models/push_notification.model';
import User from '../models/user.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import { PushNotificationType } from '../utils/push_notification_type';


const conn = new Conn();
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
    autoBind(this);
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
    try {
      const insertFCMTokenQuery = `INSERT INTO users_fcm_tokens (user_id, fcm_token) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO 
          UPDATE SET fcm_token = EXCLUDED.fcm_token`;
      const values = [userId, token];        
      await pool.query(insertFCMTokenQuery, values);
      response.status(200).send('FCM token has been added');
    } catch (error) {
      response.status(400).send(error);
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

  sendPNSecondTrainingReminder(userId: string, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
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

  sendPNStudentAddedToLesson(student: User, lesson: Lesson): void {
    const mentorName = lesson.mentor?.name;
    const fieldName = student.field?.name?.toLowerCase();   
    const recurring = lesson.isRecurrent ? 'recurring ' : '';
    const lessonRecurrence = lesson.isRecurrent ? 'lesson recurrence' : 'next lesson';
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

  sendPNLessonRequest(student: User, lessonRequest: LessonRequest): void {
    const mentorId = lessonRequest.mentor?.id;
    const subfieldName = lessonRequest.subfield?.name?.toLowerCase();
    const pushNotification: PushNotification = {
      title: 'New lesson request',
      body: `${student.name} from ${student.organization?.name} is requesting a ${subfieldName} lesson with you`,
      type: PushNotificationType.LessonRequest
    }
    this.sendPushNotification(mentorId as string, pushNotification);
  }
  
  sendPNLessonRequestAccepted(lesson: Lesson): void {
    const recurring = lesson.isRecurrent ? 'recurring ' : '';
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
    if (lesson.isRecurrent && isCancelAll) {
      title = 'Lessons recurrence canceled';
      body = `We're sorry but the mentor has canceled the lesson recurrence`;
    } else {
      title = 'Next lesson canceled';
      body = `We're sorry but the mentor has canceled the next lesson`;
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
    if (lessonsCanceled == 0) {
      const studentName = student.name;
      const lessonRecurrence = lesson.isRecurrent && isCancelAll ? 'lesson recurrence' : 'next lesson';
      title = 'Next lesson status';
      body = `${studentName} won't participate in the ${lessonRecurrence}`;
    } else if (lessonsCanceled == 1) {
      title = 'Next lesson canceled';
      body = `The next lesson has been canceled by the only participant`;
    } else {
      title = 'Next lessons canceled';
      body = `The next ${lessonsCanceled} lessons have been canceled by the only participant`;
    }
    const pushNotification: PushNotification = {
      title: title,
      body: body
    }      
    if (lesson.mentor != null) {    
      this.sendPushNotification(lesson.mentor.id as string, pushNotification);
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
  
  sendPNAfterLesson(lesson: Lesson): void {
    const pushNotificationMentor: PushNotification = {
      title: 'Taught today',
      body: 'Please mention briefly what you have taught today',
      type: PushNotificationType.AfterLesson
    }
    const pushNotificationStudent: PushNotification = {
      title: 'Learned today',
      body: 'Please mention briefly what you have learned today',
      type: PushNotificationType.AfterLesson
    }
    const mentor = lesson.mentor;
    this.sendPushNotification(mentor?.id as string, pushNotificationMentor);
    const students = lesson.students;
    if (students != null) {
      for (const student of students) {
        this.sendPushNotification(student.id as string, pushNotificationStudent);
      }
    }
  }
}

