import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import ApprovedUser from '../models/approved_user.model';
import Field from '../models/field.model';
import Organization from '../models/organization.model';

const conn = new Conn();
const pool = conn.pool;
dotenv.config();

export class ApprovedUsers {
  constructor() {
    autoBind(this);
  }

  async getApprovedUser(email: string, client: pg.PoolClient): Promise<ApprovedUser> {
    let approvedUser: ApprovedUser = {
      email: email
    };
    const getApprovedUserQuery = 'SELECT field_id, organization_id, name, phone_number, is_mentor, goal FROM approved_users WHERE LOWER(email) = $1';
    const { rows }: pg.QueryResult = await client.query(getApprovedUserQuery, [email.toLowerCase()]);
    if (!rows[0]) {
      approvedUser.email = '';
    } else {
      const field: Field = {
        id: rows[0].field_id
      }
      const organization: Organization = {
        id: rows[0].organization_id
      }      
      approvedUser = {
        email: email,
        name: rows[0].name,
        phoneNumber: rows[0].phone_number,
        field: field,
        organization: organization,
        isMentor: rows[0].is_mentor,
        goal: rows[0].goal
      };
    }
    return approvedUser;
  }

  async addApprovedUser(request: Request, response: Response): Promise<void> {
    const { email, phoneNumber, organization, isMentor }: ApprovedUser = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let approvedUserExists = false;
      const getApprovedUsersQuery = 'SELECT id FROM approved_users WHERE email = $1';
      const { rows }: pg.QueryResult = await client.query(getApprovedUsersQuery, [email]);
      if (rows[0]) {
        approvedUserExists = true;
      }
      if (!approvedUserExists) {
        if (organization && !organization.id) {
          organization.id = process.env.OTHER_ORGANIZATION_ID;
        }
        let insertApprovedUserQuery;
        let values;
        const fieldId = process.env.OTHER_FIELD_ID;
        if (isMentor) {
          insertApprovedUserQuery = `INSERT INTO approved_users (email, field_id, organization_id, is_mentor)
          VALUES ($1, $2, $3, $4)`;
          values = [email, fieldId, organization?.id, isMentor];
        } else {
          const goal = 'I want to have an income of at least $1000 USD per month';
          insertApprovedUserQuery = `INSERT INTO approved_users (email, phone_number, field_id, organization_id, is_mentor, goal)
            VALUES ($1, $2, $3, $4, $5, $6)`;
          values = [email, phoneNumber, fieldId, organization?.id, isMentor, goal];        
        }
        await client.query(insertApprovedUserQuery, values);
        response.status(200).send('Approved user has been added');
      } else {
        response.status(200).send('Approved user already exists');
      }
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  
}

