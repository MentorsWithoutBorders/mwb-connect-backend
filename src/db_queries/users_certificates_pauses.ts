import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment'
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import CertificatePause from '../models/certificate_pause.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class UsersCertificatesPauses {
  constructor() {
    helpers.autoBind(this);
  }

  async getUserCertificatePause(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getCertificatePauseQuery = `SELECT is_resuming FROM users_certificates_pauses 
        WHERE user_id = $1 
        ORDER BY pause_datetime DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getCertificatePauseQuery, [userId]);
      const certificatePause: CertificatePause = {
        isResuming: rows[0].is_resuming
      }
      response.status(200).send(certificatePause);
    } catch (error) {
      response.status(400).send(error);
    }
  }   

  async addUserCertificatePause(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const insertCertificatePauseQuery = `INSERT INTO users_certificates_pauses (user_id, pause_datetime, is_resuming)
        VALUES ($1, $2, $3)`;
      const pauseDateTime = moment.utc();
      const values = [userId, pauseDateTime, false];        
      await pool.query(insertCertificatePauseQuery, values);
      response.status(200).send('Certificate pause inserted');
    } catch (error) {
      console.log(error)
    }
  }
}

