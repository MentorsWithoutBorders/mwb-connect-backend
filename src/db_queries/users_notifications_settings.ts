import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import { UsersSendEmails } from './users_send_emails';
import NotificationsSettings from '../models/notifications_settings.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const usersSendEmails = new UsersSendEmails();

export class UsersNotificationsSettings {
  constructor() {
    helpers.autoBind(this);
  }

  async getNotificationsSettings(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getNotificationsSettingsQuery = 'SELECT enabled, time FROM users_notifications_settings WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getNotificationsSettingsQuery, [userId]);
      const time = rows[0].time.substring(0, rows[0].time.lastIndexOf(':'));
      const notificationsSettings: NotificationsSettings = {
        enabled: rows[0].enabled,
        time: time
      }
      response.status(200).json(notificationsSettings);
    } catch (error) {
      response.status(400).send(error);
    } 
  }

  async updateNotificationsSettings(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { enabled, time }: NotificationsSettings = request.body
    try {
      const updateNotificationsSettingsQuery = `UPDATE users_notifications_settings
        SET enabled = $1, time = $2 WHERE user_id = $3`;
      const values = [enabled, time, userId];
      await pool.query(updateNotificationsSettingsQuery, values);
      usersSendEmails.sendEmailNotificationsSettingsUpdate(userId, enabled);
      response.status(200).send(`Notifications settings have been updated for user: ${userId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }    
}

