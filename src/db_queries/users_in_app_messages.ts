import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import InAppMessage from '../models/in_app_message';

const conn = new Conn();
const pool = conn.pool;

export class UsersInAppMessages {
  constructor() {
    autoBind(this);
  }

  async getUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const inAppMessage = await this.getUserInAppMessageFromDB(userId);
      response.status(200).json(inAppMessage);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
  
  async getUserInAppMessageFromDB(userId: string): Promise<InAppMessage> {
    const getUserInAppMessageQuery = 'SELECT text FROM users_in_app_messages WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserInAppMessageQuery, [userId]);
    let inAppMessage: InAppMessage = {};
    if (rows[0]) {
      inAppMessage = {
        userId: userId,
        text: rows[0].text
      }
    }
    return inAppMessage;
  }  

  async addUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { text }: InAppMessage = request.body
    try {
      await this.deleteUserInAppMessageFromDB(userId);
      await this.addUserInAppMessageFromDB(userId, text);
      response.status(200).send('In app message has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addUserInAppMessageFromDB(userId: string, text: string | undefined): Promise<void> {
    const insertInAppMessageQuery = `INSERT INTO users_in_app_messages (user_id, text)
      VALUES ($1, $2)`;
    const values = [userId, text];
    await pool.query(insertInAppMessageQuery, values);    
  }

  async deleteUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      await this.deleteUserInAppMessageFromDB(userId);
      response.status(200).json(`In-app message has been deleted successfully`);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
  
  async deleteUserInAppMessageFromDB(userId: string): Promise<void> {
    const deleteUserInAppMessageQuery = 'DELETE FROM users_in_app_messages WHERE user_id = $1';
    await pool.query(deleteUserInAppMessageQuery, [userId]);
  }
}

