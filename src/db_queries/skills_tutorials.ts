// @ts-nocheck

import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';

import SkillTutorial from '../models/skill_tutorial.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class SkillsTutorials {
  constructor() {
    helpers.autoBind(this);
  }

  async getSkillsTutorials(
    request: Request,
    response: Response
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const skillsTutorials = await this.getSkillsTutorialsFromDB(client);
      response.status(200).json(skillsTutorials);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getSkillsTutorialsFromDB(
    client: pg.PoolClient
  ): Promise<Array<SkillTutorial>> {
    const getSkillsTutorialsQuery =
      'SELECT id, skill_id, tutorial_id, times_used FROM skills_tutorials ORDER BY times_used DESC';
    const { rows }: pg.QueryResult = await client.query(
      getSkillsTutorialsQuery
    );
    const skillsTutorials: Array<SkillTutorial> = [];
    for (const row of rows) {
      const skillTutorial: SkillTutorial = {
        id: row.id,
        skillId: row.skill_id,
        tutorialId: row.tutorial_id,
        timesUsed: row.times_used
      };
      skillsTutorials.push(skillTutorial);
    }
    return skillsTutorials;
  }

  async getSkillTutorialById(
    request: Request,
    response: Response
  ): Promise<void> {
    const skillTutorialId = request.params.id;
    try {
      const getSkillTutorialQuery =
        'SELECT skill_id, tutorial_id, times_used FROM skills_tutorials WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(getSkillTutorialQuery, [
        skillTutorialId
      ]);
      const skillTutorial: SkillTutorial = {
        id: skillTutorialId,
        skillId: rows[0].skill_id,
        tutorialId: rows[0].tutorial_id,
        timesUsed: rows[0].times_used
      };
      response.status(200).json(skillTutorial);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addSkillTutorial(request: Request, response: Response): Promise<void> {
    const { skillId, tutorialId, timesUsed }: SkillTutorial = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertSkillTutorialQuery = `INSERT INTO skills_tutorials (skill_id, tutorial_id, times_used)
        VALUES ($1, $2, $3) RETURNING *`;
      const values = [skillId, tutorialId, timesUsed];
      const { rows }: pg.QueryResult = await client.query(
        insertSkillTutorialQuery,
        values
      );
      const skillTutorial: SkillTutorial = {
        id: rows[0].id,
        skillId: skillId,
        tutorialId: tutorialId,
        timesUsed: timesUsed
      };
      response.status(200).send(skillTutorial);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateSkillTutorial(
    request: Request,
    response: Response
  ): Promise<void> {
    const skillTutorialId = request.params.id;
    const { skillId, tutorialId, timesUsed }: SkillTutorial = request.body;
    try {
      const updateSkillTutorialQuery =
        'UPDATE skills_tutorials SET skill_id = $1, tutorial_id = $2, times_used = $3 WHERE id = $4';
      await pool.query(updateSkillTutorialQuery, [
        skillId,
        tutorialId,
        timesUsed,
        skillTutorialId
      ]);
      response
        .status(200)
        .send(`Skill tutorial modified with ID: ${skillTutorialId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteSkillTutorial(
    request: Request,
    response: Response
  ): Promise<void> {
    const skillTutorialId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteSkillTutorialQuery =
        'DELETE FROM skills_tutorials WHERE id = $1';
      await client.query(deleteSkillTutorialQuery, [skillTutorialId]);
      response
        .status(200)
        .send(`Skill tutorial deleted with ID: ${skillTutorialId}`);
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
