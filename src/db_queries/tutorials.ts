import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Tutorial from '../models/tutorial.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Tutorials {
  constructor() {
    autoBind(this);
  }

  // not considered for transactions yet
  async getTutorials(request: Request, response: Response): Promise<void> {
    try {
      const getTutorialsQuery = 'SELECT * FROM tutorials ORDER BY index';
      const { rows }: pg.QueryResult = await pool.query(getTutorialsQuery);
      const tutorials: Array<Tutorial> = [];
      for (const row of rows) {
        const tutorial: Tutorial = {
          type: row.type,
          sections: await this.getTutorialSections(row.id)
        };
        tutorials.push(tutorial);
      }
      response.status(200).json(tutorials);
    } catch (error) {
      response.status(400).send(error);
    } 
  }

  // not considered for transactions yet
  async getTutorialSections(id: string): Promise<Array<string>> {
    const getTutorialSectionsQuery = `SELECT * FROM tutorials_sections 
      WHERE tutorial_id = $1
      ORDER BY index`;
    const { rows }: pg.QueryResult = await pool.query(getTutorialSectionsQuery, [id]);
    const sections: Array<string> = [];
    for (const row of rows) {
      sections.push(row.type);
    }
    return sections;
  }  
}

