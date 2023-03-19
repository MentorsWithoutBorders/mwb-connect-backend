import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import TutorialLesson from '../models/tutorial_lesson.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class TutorialsLessons {
  constructor() {
    helpers.autoBind(this);
  }

  async getTutorialsLessons(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getTutorialsLessonsQuery = 'SELECT id, name, first_lesson_url FROM tutorials_lessons';
      const { rows }: pg.QueryResult = await client.query(getTutorialsLessonsQuery);
      const tutorialsLessons: Array<TutorialLesson> = [];
      for (const row of rows) {
        const tutorialLesson: TutorialLesson = {
          id: row.id,
          name: row.name,
          firstLessonUrl: row.first_lesson_url
        };
        tutorialsLessons.push(tutorialLesson);
      }
      response.status(200).json(tutorialsLessons);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }
}

