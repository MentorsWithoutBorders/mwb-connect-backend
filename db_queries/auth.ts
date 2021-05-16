import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Users } from './users';
import Token from '../models/token.model';
import Tokens from '../models/tokens.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const db: Users = new Users();

export class Auth {
  async verifyAccessToken(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!request.headers.authorization) {
      response.status(400).send({'message': 'Token is not provided'});
      return ;
    }  
    const token: string = request.headers.authorization.replace('Bearer ','');
    if (!token) {
      response.status(400).send({'message': 'Token is not provided'});
      return ;
    }
    try {
      const decoded: string | object = await jwt.verify(token, 'super-secret');
      const usersQuery: string = 'SELECT * FROM users WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(usersQuery, [(decoded as Token).userId]);
      if (!rows[0]) {
        response.status(400).send({'message': 'The token you provided is invalid'});
        return ;
      }
      request.user = { id: (decoded as Token).userId };
      next();
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getAccessToken(request: Request, response: Response): Promise<void> {
    const { userId, refreshToken }: { userId: string, refreshToken: string } = request.body;
    try {
      const getQuery: string = 'SELECT * FROM refresh_tokens WHERE user_id = $1 AND refresh_token = $2';
      const { rows }: pg.QueryResult = await pool.query(getQuery, [userId, refreshToken]);
      if (rows[0]) {
        const tokens: Tokens = await db.setTokens(userId);
        response.status(201).send(tokens);
      } else {
        db.revokeRefreshToken(userId);
        response.status(400).send({'message': 'Refresh token is invalid'});
      }      
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}