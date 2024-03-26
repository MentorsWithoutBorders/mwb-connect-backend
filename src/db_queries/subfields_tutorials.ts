// @ts-nocheck

import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import SubfieldTutorial from '../models/subfield_tutorial.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class SubfieldsTutorials {
  constructor() {
    helpers.autoBind(this);
  }

  async getSubfieldsTutorials(
    request: Request,
    response: Response
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const subfieldsTutorials = await this.getSubfieldsTutorialsFromDB(client);
      response.status(200).json(subfieldsTutorials);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getSubfieldsTutorialsFromDB(
    client: pg.PoolClient
  ): Promise<Array<SubfieldTutorial>> {
    const getSubfieldsTutorialsQuery =
      'SELECT id, subfield_id, tutorial_id, times_used FROM subfields_tutorials ORDER BY times_used DESC';
    const { rows }: pg.QueryResult = await client.query(
      getSubfieldsTutorialsQuery
    );
    const subfieldsTutorials: Array<SubfieldTutorial> = [];
    for (const row of rows) {
      const subfieldTutorial: SubfieldTutorial = {
        id: row.id,
        subfieldId: row.subfield_id,
        tutorialId: row.tutorial_id,
        timesUsed: row.times_used
      };
      subfieldsTutorials.push(subfieldTutorial);
    }
    return subfieldsTutorials;
  }

  async getSubfieldTutorialById(
    request: Request,
    response: Response
  ): Promise<void> {
    const subfieldTutorialId = request.params.id;
    try {
      const getSubfieldTutorialQuery =
        'SELECT subfield_id, tutorial_id, times_used FROM subfields_tutorials WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(
        getSubfieldTutorialQuery,
        [subfieldTutorialId]
      );
      const subfieldTutorial: SubfieldTutorial = {
        id: subfieldTutorialId,
        subfieldId: rows[0].subfield_id,
        tutorialId: rows[0].tutorial_id,
        timesUsed: rows[0].times_used
      };
      response.status(200).json(subfieldTutorial);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addSubfieldTutorial(
    request: Request,
    response: Response
  ): Promise<void> {
    const { subfieldId, tutorialId, timesUsed }: SubfieldTutorial =
      request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertSubfieldTutorialQuery = `INSERT INTO subfields_tutorials (subfield_id, tutorial_id, times_used)
        VALUES ($1, $2, $3) RETURNING *`;
      const values = [subfieldId, tutorialId, timesUsed];
      const { rows }: pg.QueryResult = await client.query(
        insertSubfieldTutorialQuery,
        values
      );
      const subfieldTutorial: SubfieldTutorial = {
        id: rows[0].id,
        subfieldId: subfieldId,
        tutorialId: tutorialId,
        timesUsed: timesUsed
      };
      response.status(200).send(subfieldTutorial);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateSubfieldTutorial(
    request: Request,
    response: Response
  ): Promise<void> {
    const subfieldTutorialId = request.params.id;
    const { subfieldId, tutorialId, timesUsed }: SubfieldTutorial =
      request.body;
    try {
      const updateSubfieldTutorialQuery =
        'UPDATE subfields_tutorials SET subfield_id = $1, tutorial_id = $2, times_used = $3 WHERE id = $4';
      await pool.query(updateSubfieldTutorialQuery, [
        subfieldId,
        tutorialId,
        timesUsed,
        subfieldTutorialId
      ]);
      response
        .status(200)
        .send(`Subfield tutorial modified with ID: ${subfieldTutorialId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteSubfieldTutorial(
    request: Request,
    response: Response
  ): Promise<void> {
    const subfieldTutorialId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteSubfieldTutorialQuery =
        'DELETE FROM subfields_tutorials WHERE id = $1';
      await client.query(deleteSubfieldTutorialQuery, [subfieldTutorialId]);
      response
        .status(200)
        .send(`Subfield tutorial deleted with ID: ${subfieldTutorialId}`);
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
