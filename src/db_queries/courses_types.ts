import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import CourseType from '../models/course_type.model';

const conn = new Conn();
const pool = conn.pool;

export class CoursesTypes {
  constructor() {
    autoBind(this);
  }

  async getCoursesTypes(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getCoursesTypesQuery = 'SELECT id, duration, is_with_partner FROM courses_types';
      const { rows }: pg.QueryResult = await client.query(getCoursesTypesQuery);
      const coursesTypes: Array<CourseType> = [];
      for (const row of rows) {
        const courseType: CourseType = {
          id: row.id,
          duration: row.duration,
          isWithPartner: row.is_with_partner
        };
        coursesTypes.push(courseType);
      }
      response.status(200).json(coursesTypes);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }
}

