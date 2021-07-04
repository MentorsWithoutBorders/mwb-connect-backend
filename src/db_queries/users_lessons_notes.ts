import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import LessonNote from '../models/lesson_note.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersLessonsNotes {
  constructor() {
    autoBind(this);
  }

  async addLessonNote(request: Request, response: Response): Promise<void> {
    const { studentId, lessonId, text }: LessonNote = request.body
    try {
      const insertLessonNoteQuery = `INSERT INTO users_lessons_notes (student_id, lesson_id, text)
        VALUES ($1, $2, $3)`;
      const values = [studentId, lessonId, text];
      await pool.query(insertLessonNoteQuery, values);
      response.status(200).send('Lesson note has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async getStudentLessonNotes(request: Request, response: Response): Promise<void> {
    const studentId: string = request.params.id;
    try {
      const getLessonNotesQuery = `SELECT ul.date_time, uln.text
        FROM users_lessons_notes uln
        JOIN users_lessons ul
        ON uln.lesson_id = ul.id
        WHERE uln.student_id = $1
        ORDER BY ul.date_time DESC`;
      const { rows }: pg.QueryResult = await pool.query(getLessonNotesQuery, [studentId]);
      const lessonNotes: Array<LessonNote> = [];
      rows.forEach(function (row) {
        const lessonNote: LessonNote = {
          dateTime: moment.utc(rows[0].date_time).format(constants.DATE_TIME_FORMAT),
          text: row.text
        };
        lessonNotes.push(lessonNote);
      });      
      response.status(200).json(lessonNotes);
    } catch (error) {
      response.status(400).send(error);
    }   
  }  
}

