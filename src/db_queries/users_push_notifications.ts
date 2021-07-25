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
  timeToLive: 3
};

export class UsersPushNotifications {
  constructor() {
    autoBind(this);
  }

  async getUserFCMToken(userId: string): Promise<string> {
    const getFCMTokenQuery = 'SELECT fcm_token FROM users_fcm_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getFCMTokenQuery, [userId]);
    return rows[0].fcm_token;
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
    const payload = {
      notification: {
        title: pushNotification.title,
        body: pushNotification.body
      }
    };
    admin.messaging().sendToDevice(registrationToken, payload, notificationOptions)
    .then()
    .catch(error => {
      console.log(error);
    });    
  }

  sendPushNotificationLessonRequest(student: User, lessonRequestOptions: Array<LessonRequest>): void {
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
}

