import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import NotificationsSettings from '../models/notifications_settings.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersNotificationsSettings {
  constructor() {
    autoBind(this);
  }

  async getNotificationsSettings(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const getNotificationsSettingsQuery = 'SELECT * FROM users_notifications_settings WHERE user_id = $1';
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
    const userId: string = request.params.id;
    const { enabled, time }: NotificationsSettings = request.body
    try {
      const updateNotificationsSettingsQuery = `UPDATE users_notifications_settings
        SET enabled = $1, time = $2 WHERE user_id = $3`;
      const values = [enabled, time, userId];
      await pool.query(updateNotificationsSettingsQuery, values);
      response.status(200).send(`Notifications settings have been updated for user: ${userId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }    
}

