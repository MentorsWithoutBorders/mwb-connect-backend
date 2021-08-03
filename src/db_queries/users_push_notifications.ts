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


const conn: Conn = new Conn();
const pool = conn.pool;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  }),
  databaseURL: 'https://mwb-connect.firebaseio.com'
});
const notificationOptions = {
  priority: "high",
  timeToLive: 60 * 60 * 24
};

export class UsersPushNotifications {
  constructor() {
    autoBind(this);
  }

  async getUserFCMToken(userId: string): Promise<string> {
    const getFCMTokenQuery = 'SELECT fcm_token FROM users_fcm_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getFCMTokenQuery, [userId]);
    return rows[0]?.fcm_token;
  }

  async addFCMToken(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
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

  sendPNLessonRequest(student: User, lessonRequestOptions: Array<LessonRequest>): void {
    if (lessonRequestOptions.length > 0) {
      const mentorId = lessonRequestOptions[0].mentor?.id;
      const subfield = lessonRequestOptions[0].subfield?.name?.toLowerCase();
      const pushNotification: PushNotification = {
        title: 'New lesson request',
        body: `${student.name} from ${student.organization?.name} is requesting a ${subfield} lesson with you`
      }
      this.sendPushNotification(mentorId as string, pushNotification);
    }
  }
  
  sendPNLessonRequestAccepted(lesson: Lesson): void {
    const recurring = lesson.isRecurrent ? 'recurring' : '';
    const mentor = lesson.mentor?.name;
    const subfield = lesson.subfield?.name?.toLowerCase();
    const pushNotification: PushNotification = {
      title: 'Lesson request accepted',
      body: `${mentor} has scheduled a ${recurring} ${subfield} lesson with you`
    }
    const students = lesson.students;
    const student = students != null ? students[0] : {};
    this.sendPushNotification(student.id as string, pushNotification);
  }
  
  sendPNLessonCanceled(lesson: Lesson, isCancelAll: boolean, lessonsCanceled: number): void {
    let title = '';
    let body = '';
    const isMentor = lesson.mentor == null ? true : false;
    if (isMentor) { // canceled by mentor
      if (!isCancelAll) {
        title = 'Next lesson canceled';
        body = `We're sorry but the mentor has canceled the next lesson`;
      } else {
        title = 'Lessons recurrence canceled';
        body = `We're sorry but the mentor has canceled the lesson recurrence`;
      }
    } else {
      if (lessonsCanceled == 1) {
        title = 'Next lesson canceled';
        body = `The next lesson has been canceled for lack of participants`;
      } else {
        title = 'Next lessons canceled';
        body = `The next ${lessonsCanceled} lessons have been canceled for lack of participants`;
      }
    }
    const pushNotification: PushNotification = {
      title: title,
      body: body
    }
    if (isMentor) {
      this.sendPNLessonCanceledStudents(lesson, pushNotification);
    } else {
      if (lessonsCanceled >= 1) {
        this.sendPNLessonCanceledMentor(lesson, pushNotification);
      }
    }
  }
  
  sendPNLessonCanceledStudents(lesson: Lesson, pushNotification: PushNotification): void {
    if (lesson.students != null) {
      for (const student of lesson.students) {
        this.sendPushNotification(student.id as string, pushNotification);
      }
    }
  }

  sendPNLessonCanceledMentor(lesson: Lesson, pushNotification: PushNotification): void {
    if (lesson.mentor != null) {
      this.sendPushNotification(lesson.mentor.id as string, pushNotification);
    }
  }
  
  sendPNLessonRecurrenceUpdated(students: Array<User>): void {
    const pushNotification: PushNotification = {
      title: 'Lesson recurrence updated',
      body: 'The mentor has updated the lesson recurrence'
    }    
    if (students != null) {
      for (const student of students) {
        this.sendPushNotification(student.id as string, pushNotification);
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

