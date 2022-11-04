import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import FieldTutorial from '../models/field_tutorial.model';

const conn = new Conn();
const pool = conn.pool;

export class FieldsTutorials {
  constructor() {
    autoBind(this);
  }

  async getFieldsTutorials(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const fieldsTutorials = await this.getFieldsTutorialsFromDB(client);
      response.status(200).json(fieldsTutorials);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getFieldsTutorialsFromDB(client: pg.PoolClient): Promise<Array<FieldTutorial>> {
    const getFieldsTutorialsQuery = 'SELECT id, field_id, tutorial_id, times_used FROM fields_tutorials ORDER BY times_used DESC';
    const { rows }: pg.QueryResult = await client.query(getFieldsTutorialsQuery);
    const fieldsTutorials: Array<FieldTutorial> = [];
    for (const row of rows) {
      const fieldTutorial: FieldTutorial = {
        id: row.id,
        fieldId: row.field_id,
        tutorialId: row.tutorial_id,
        timesUsed: row.times_used,
      };
      fieldsTutorials.push(fieldTutorial);
    }
    return fieldsTutorials;
  }

  async getFieldTutorialById(request: Request, response: Response): Promise<void> {
    const fieldTutorialId = request.params.id;
    try {
      const getFieldTutorialQuery = 'SELECT field_id, tutorial_id, times_used FROM fields_tutorials WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(getFieldTutorialQuery, [fieldTutorialId]);
      const fieldTutorial: FieldTutorial = {
        id: fieldTutorialId,
        fieldId: rows[0].field_id,
        tutorialId: rows[0].tutorial_id,
        timesUsed: rows[0].times_used
      };
      response.status(200).json(fieldTutorial);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addFieldTutorial(request: Request, response: Response): Promise<void> {
    const { fieldId, tutorialId, timesUsed }: FieldTutorial = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertFieldTutorialQuery = `INSERT INTO fields_tutorials (field_id, tutorial_id, times_used)
        VALUES ($1, $2, $3) RETURNING *`;
      const values = [fieldId, tutorialId, timesUsed];        
      const { rows }: pg.QueryResult = await client.query(insertFieldTutorialQuery, values);
      const fieldTutorial: FieldTutorial = {
        id: rows[0].id,
        fieldId: fieldId,
        tutorialId: tutorialId,
        timesUsed: timesUsed
      }  
      response.status(200).send(fieldTutorial);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateFieldTutorial(request: Request, response: Response): Promise<void> {
    const fieldTutorialId = request.params.id;
    const { fieldId, tutorialId, timesUsed }: FieldTutorial = request.body;
    try {
      const updateFieldTutorialQuery = 'UPDATE fields_tutorials SET field_id = $1, tutorial_id = $2, times_used = $3 WHERE id = $4';
      await pool.query(updateFieldTutorialQuery, [fieldId, tutorialId, timesUsed, fieldTutorialId]);
      response.status(200).send(`Field tutorial modified with ID: ${fieldTutorialId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteFieldTutorial(request: Request, response: Response): Promise<void> {
    const fieldTutorialId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteFieldTutorialQuery = 'DELETE FROM fields_tutorials WHERE id = $1';
      await client.query(deleteFieldTutorialQuery, [fieldTutorialId]);
      response.status(200).send(`Field tutorial deleted with ID: ${fieldTutorialId}`);
      await client.query('COMMIT');
    } catch (error) {
      console.log(error);
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  
}

