import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import ApprovedUser from '../models/approved_user.model';
import Field from '../models/field.model';
import Organization from '../models/organization.model';

const conn = new Conn();
const pool = conn.pool;

export class ApprovedUsers {
  constructor() {
    autoBind(this);
  }

  async getApprovedUser(email: string, client: pg.PoolClient): Promise<ApprovedUser> {
    let approvedUser: ApprovedUser = {
      email: email
    };
    const getApprovedUserQuery = 'SELECT field_id, organization_id, name, is_mentor, goal FROM approved_users WHERE LOWER(email) = $1';
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
        field: field,
        organization: organization,
        isMentor: rows[0].is_mentor,
        goal: rows[0].goal
      };
    }
    return approvedUser;
  }  

  async addApprovedUser(request: Request, response: Response): Promise<void> {
    const { email, whatsappNumber, organization, isMentor }: ApprovedUser = request.body    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let approvedUserExists = false;
      const getApprovedUsersQuery = 'SELECT id FROM approved_users WHERE email = $1';
      let { rows }: pg.QueryResult = await client.query(getApprovedUsersQuery, [email]);
      if (rows[0]) {
        approvedUserExists = true;
      }
      if (!approvedUserExists) {
        if (organization) {
          organization.id = '1838ae4e-4d07-4b03-8c7e-e1aa07fa9835'; // Other organization
          const getOrganizationQuery = 'SELECT id FROM organizations WHERE name = $1';
          ({ rows } = await client.query(getOrganizationQuery, [organization.name]));
          if (rows[0]) {
            organization.id = rows[0].id;
          }
        }
        let insertApprovedUserQuery;
        let values;
        if (isMentor) {
          const fieldId = 'b021984a-c02c-4fd4-87a7-1aec84c68d6b'; // Programming
          insertApprovedUserQuery = `INSERT INTO approved_users (email, field_id, organization_id, is_mentor)
          VALUES ($1, $2, $3, $4)`;
          values = [email, fieldId, organization?.id, isMentor];
        } else {
          const fieldId = '62a9dce6-2e92-45cc-a580-035d64a65b5b'; // Other
          const goal = 'I want to have an income of at least $1000 USD per month';
          insertApprovedUserQuery = `INSERT INTO approved_users (email, whatsapp_number, field_id, organization_id, is_mentor, goal)
            VALUES ($1, $2, $3, $4, $5, $6)`;
          values = [email, whatsappNumber, fieldId, organization?.id, isMentor, goal];        
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

