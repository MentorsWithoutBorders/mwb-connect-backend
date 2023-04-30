import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import CourseType from '../models/course_type.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class CourseTypes {
  constructor() {
    helpers.autoBind(this);
  }

  async getCourseTypes(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(constants.READ_ONLY_TRANSACTION);
      const courseTypes = await this.getCourseTypesFromDB(client);
      response.status(200).json(courseTypes);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }  
  }

  async getCourseTypesFromDB(client: pg.PoolClient): Promise<CourseType[]> {
    const getCourseTypesQuery = 'SELECT id, duration, is_with_partner, index FROM course_types ORDER BY index';
    const { rows }: pg.QueryResult = await client.query(getCourseTypesQuery);
    const courseTypes: Array<CourseType> = [];
    for (const row of rows) {
      const courseType: CourseType = {
        id: row.id,
        duration: row.duration,
        isWithPartner: row.is_with_partner,
        index: row.index
      };
      courseTypes.push(courseType);
    }
    return courseTypes;
  }
}

