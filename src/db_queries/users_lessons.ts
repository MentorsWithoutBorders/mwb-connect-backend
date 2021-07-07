import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersSkills } from './users_skills';
import { Skills } from './skills';
import User from '../models/user.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Organization from '../models/organization.model';
import Lesson from '../models/lesson.model';
import LessonNote from '../models/lesson_note.model';
import GuideTutorial from '../models/guide_tutorial.model';
import Skill from '../models/skill.model';
import GuideRecommendation from '../models/guide_recommendation.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const helpers: Helpers = new Helpers();
const users: Users = new Users();
const usersSkills: UsersSkills = new UsersSkills();
const skillsQueries: Skills = new Skills();

export class UsersLessons {
  constructor() {
    autoBind(this);
  }

  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);
      const lesson = await this.getNextLessonFromDB(userId, client);
      response.status(200).json(lesson);
      await client.query("COMMIT");
    } catch (error) {
      response.status(500).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getNextLessonFromDB(userId: string, client: pg.PoolClient): Promise<Lesson> {
    const isMentor = await this.getIsMentor(userId, client);
    let getNextLessonQuery = '';
    if (isMentor) {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_recurrence_date_selected, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE ul.mentor_id = $1 AND ul.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;
    } else {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_recurrence_date_selected, ul.is_canceled
        FROM users_lessons ul
        JOIN users_lessons_students uls
        ON ul.id = uls.lesson_id        
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE uls.student_id = $1 AND ul.is_canceled IS DISTINCT FROM true AND uls.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;      
    }
    const { rows }: pg.QueryResult = await client.query(getNextLessonQuery, [userId]);
    let lessonRow = rows[0];
    let students: Array<User> = [];
    if (lessonRow) {
      const lesson: Lesson = {
        id: lessonRow.id,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        isRecurrent: lessonRow.is_recurrent,
        isRecurrenceDateSelected: lessonRow.is_recurrence_date_selected
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      const lessonDateTime = await this.getNextLessonDateTime(lesson, userId, client);
      if (lessonDateTime == undefined) {
        lessonRow = null;
      } else {
        lessonRow.date_time = lessonDateTime;
        students = await this.getLessonStudents(lessonRow.id, client);
      }
    }
    return this.setLesson(lessonRow, students, isMentor, client);
  }

  async getNextLessonDateTime(lesson: Lesson, userId: string, client: pg.PoolClient): Promise<string | undefined> {
    const now = moment.utc();
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    let lessonDateTime = moment.utc(lesson.dateTime);
    if (lesson.isRecurrent) {
      if (endRecurrenceDateTime.isBefore(now)) {
        return undefined;
      } else {
        while (lessonDateTime.isBefore(now)) {
          lessonDateTime = lessonDateTime.add(7, 'd');
        }
        const nextValidLessonDateTime = await this.getNextValidLessonDateTime(lesson, userId, lessonDateTime, client);
        if (nextValidLessonDateTime.isAfter(endRecurrenceDateTime)) {
          return undefined;
        } else {
          return moment.utc(nextValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
        }
      }
    } else {
      if (lessonDateTime.isBefore(now)) {
        return undefined;
      } else {
        return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
      }
    }
  }

  async getNextValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonsCanceledDateTimes = await this.getLessonsCanceledDateTimes(userId, lesson.id as string, client);
    lessonsCanceledDateTimes.forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.add(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }

  async getLessonsCanceledDateTimes(userId: string, lessonId: string, client: pg.PoolClient): Promise<Array<string>> {
    const getLessonCanceledQuery = `SELECT lesson_date_time
      FROM users_lessons_canceled
      WHERE user_id = $1 AND lesson_id = $2`;
    const { rows }: pg.QueryResult = await client.query(getLessonCanceledQuery, [userId, lessonId]);
    let lessonsCanceledDateTimes: Array<string> = [];
    rows.forEach(function (row) {
      lessonsCanceledDateTimes.push(row.lesson_date_time);
    });
    lessonsCanceledDateTimes = lessonsCanceledDateTimes.sort((d1, d2) => {
      if (moment.utc(d1).isAfter(moment.utc(d2))) {
        return 1;
      }
      if (moment.utc(d1).isBefore(moment.utc(d2))) {
        return -1;
      }
      return 0;
    });
    return lessonsCanceledDateTimes;
  }

  async getLessonStudents(lessonId: string, client: pg.PoolClient): Promise<Array<User>> {
    const getLessonStudentsQuery = `SELECT student_id, is_canceled
      FROM users_lessons_students
      WHERE lesson_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonStudentsQuery, [lessonId]);
    const students: Array<User> = [];
    for (const studentRow of rows) {
      if (!studentRow.is_canceled) {
        const user: User = await users.getUserFromDB(studentRow.student_id, client);
        const student: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }
        students.push(student);
      }
    }  
    return students;  
  }

  async setLesson(lessonRow: pg.QueryResultRow, students: Array<User>, isMentor: boolean, client: pg.PoolClient): Promise<Lesson> {
    let lesson: Lesson = {};
    if (lessonRow) {    
      const subfield: Subfield = {
        id: lessonRow.subfield_id,
        name: lessonRow.subfield_name
      }
      lesson = {
        id: lessonRow.id,
        subfield: subfield,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        meetingUrl: lessonRow.meeting_url,
        isRecurrent: lessonRow.is_recurrent,
        isCanceled: lessonRow.is_canceled
      }
      if (isMentor) {
        lesson.isRecurrenceDateSelected = lessonRow.is_recurrence_date_selected;
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      if (isMentor) {
        lesson.students = students;
      } else {
        const user: User = await users.getUserFromDB(lessonRow.mentor_id, client);
        const mentor: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }        
        lesson.mentor = mentor;
      }
    }
    return lesson;
  }

  async getIsMentor(userId: string, client: pg.PoolClient): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await client.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }
  
  async getPreviousLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);
      const isMentor = await this.getIsMentor(userId, client);
      const now = moment.utc();
      let getPreviousLessonQuery = '';
      if (isMentor) {
        getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
          FROM users_lessons ul
          JOIN subfields s
          ON ul.subfield_id = s.id
          WHERE ul.mentor_id = $1 AND ul.date_time::timestamp < $2
          ORDER BY ul.date_time DESC LIMIT 1`;
      } else {
        getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
          FROM users_lessons ul
          JOIN users_lessons_students uls
          ON ul.id = uls.lesson_id        
          JOIN subfields s
          ON ul.subfield_id = s.id
          WHERE uls.student_id = $1 AND ul.date_time::timestamp < $2
          ORDER BY ul.date_time DESC LIMIT 1`;      
      }
      const { rows }: pg.QueryResult = await client.query(getPreviousLessonQuery, [userId, now]);
      let lessonRow = rows[0];
      let students: Array<User> = [];
      let lesson: Lesson = {};
      if (lessonRow != null) {
        lesson = {
          id: lessonRow.id,
          dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
          isRecurrent: lessonRow.is_recurrent
        }
        if (lessonRow.end_recurrence_date_time != null) {
          lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT);
        }
        const lessonDateTime = await this.getPreviousLessonDateTime(lesson, userId, client);
        if (lessonDateTime == undefined) {
          lessonRow = null;
        } else {
          lessonRow.date_time = lessonDateTime;
          students = await this.getLessonStudents(lessonRow.id, client);
        }
      }
      lesson = await this.setLesson(lessonRow, students, isMentor, client);
      response.status(200).json(lesson);
      await client.query("COMMIT");
    } catch (error) {
      response.status(500).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
  
  async getPreviousLessonDateTime(lesson: Lesson, userId: string, client: pg.PoolClient): Promise<string | undefined> {
    const now = moment.utc();
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    let lessonDateTime = moment.utc(lesson.dateTime);
    if (lesson.isRecurrent) {
      while (lessonDateTime.isBefore(now)) {
        lessonDateTime = lessonDateTime.add(7, 'd');
      }
      lessonDateTime = lessonDateTime.subtract(7, 'd');
      const previousValidLessonDateTime = await this.getPreviousValidLessonDateTime(lesson, userId, lessonDateTime, client);
      if (endRecurrenceDateTime.isAfter(now)) {
        if (previousValidLessonDateTime.isBefore(now)) {
          return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
        } else {
          return undefined;
        }
      } else {
        return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
      } 
    } else {
      return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
    } 
  }

  async getPreviousValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonsCanceledDateTimes = await this.getLessonsCanceledDateTimes(userId, lesson.id as string, client);
    lessonsCanceledDateTimes.slice().reverse().forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.subtract(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }

  async cancelLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const lessonId: string = request.params.id;
    const { dateTime }: Lesson = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      if (dateTime) {
        const insertLessonCanceledQuery = `INSERT INTO users_lessons_canceled (user_id, lesson_id, lesson_date_time)
          VALUES ($1, $2, $3)`;
        const lessonDateTime = moment.utc(dateTime);
        const values = [userId, lessonId, lessonDateTime];
        await pool.query(insertLessonCanceledQuery, values);        
      } else {
        const isMentor = await this.getIsMentor(userId, client);
        if (isMentor) {
          const updateMentorLessonQuery = 'UPDATE users_lessons SET is_canceled = true WHERE id = $1';
          await pool.query(updateMentorLessonQuery, [lessonId]);
        } else {
          const updateStudentLessonQuery = 'UPDATE users_lessons_students SET is_canceled = true  WHERE lesson_id = $1 AND student_id = $2';
          await pool.query(updateStudentLessonQuery, [lessonId, userId]);
        }
      }
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async setLessonMeetingUrl(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonId: string = request.params.id;
    const { meetingUrl }: Lesson = request.body;
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET meeting_url = $1 WHERE mentor_id = $2 AND id = $3';
      await pool.query(updateLessonQuery, [meetingUrl, mentorId, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async setLessonRecurrence(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonId: string = request.params.id;
    const { isRecurrent, endRecurrenceDateTime, isRecurrenceDateSelected }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_recurrent = $1, end_recurrence_date_time = $2, is_recurrence_date_selected = $3 WHERE mentor_id = $4 AND id = $5';
      const endRecurrence = isRecurrent && endRecurrenceDateTime != undefined ? moment.utc(endRecurrenceDateTime) : null;
      await pool.query(updateLessonQuery, [isRecurrent, endRecurrence, isRecurrenceDateSelected, mentorId, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  } 
  
  async addStudentsSkills(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const skills = request.body;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await this.getLessonStudents(lessonId, client);
      for (const student of students) {
        const subfieldId = await this.getLessonSubfieldId(lessonId);
        await usersSkills.addUserSkillsToDB(student.id as string, subfieldId, skills, client);
      }
      response.status(200).send('Students skills have been added');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addStudentsLessonNotes(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { text }: LessonNote = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await this.getLessonStudents(lessonId, client);
      for (const student of students) {
        const insertLessonNoteQuery = `INSERT INTO users_lessons_notes (student_id, lesson_id, text)
          VALUES ($1, $2, $3)`;
        const values = [student.id, lessonId, text];
        await pool.query(insertLessonNoteQuery, values);
      }
      response.status(200).send('Lesson notes have been added');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }
  
  async getLessonSubfieldId(lessonId: string): Promise<string> {
    const getLessonQuery = `SELECT * FROM users_lessons WHERE id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getLessonQuery, [lessonId]);
    return rows[0].subfield_id;
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
  
  async getLessonGuideRecommendations(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const lessonId: string = request.params.id;
    try {
      const user = await users.getUserFromDB(userId);
      const field = user.field;
      const subfields = field?.subfields as Array<Subfield>;
      const subfieldId = await this.getLessonSubfieldId(lessonId);
      let lessonSubfield: Subfield = {};
      const guideRecommendations: Array<GuideRecommendation> = [];
      for (const subfield of subfields) {
        if (subfield.id === subfieldId) {
          lessonSubfield = subfield;
          break;
        }
      }
      guideRecommendations.push(await this.getGeneralGuideRecommendations());
      guideRecommendations.push(await this.getFieldGuideRecommendations(field as Field));
      guideRecommendations.push(await this.getSubfieldGuideRecommendations(lessonSubfield));
      response.status(200).json(guideRecommendations);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getGeneralGuideRecommendations(): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE field_id IS NULL AND subfield_id IS NULL`;
    const { rows }: pg.QueryResult = await pool.query(getGuideRecommendationsQuery);
    return {
      type: 'General',
      recommendations: rows[0].text.split(/\r?\n/)
    }    
  }

  async getFieldGuideRecommendations(field: Field): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE field_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getGuideRecommendationsQuery, [field.id]);
    return {
      type: field.name as string,
      recommendations: rows[0].text.split(/\r?\n/)
    }    
  }
  
  async getSubfieldGuideRecommendations(subfield: Subfield): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE subfield_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getGuideRecommendationsQuery, [subfield.id]);
    return {
      type: subfield.name as string,
      recommendations: rows[0].text.split(/\r?\n/)
    }    
  }   
  
  async getLessonGuideTutorials(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const lessonId: string = request.params.id;
    try {
      const user = await users.getUserFromDB(userId);
      const subfieldId = await this.getLessonSubfieldId(lessonId);
      const subfields = user.field?.subfields as Array<Subfield>;
      const skills = await this.getLessonSkills(subfieldId, subfields);
      const guideTutorialsInitial: Array<GuideTutorial> = [];
      for (const skill of skills) {
        const getGuideTutorialsQuery = `SELECT gst.skill_id, gst.tutorial_index, gt.tutorial_url
          FROM guides_tutorials gt
          JOIN guides_skills_tutorials gst
          ON gt.id = gst.tutorial_id
          WHERE gst.skill_id = $1
          ORDER BY gst.tutorial_index ASC`;
        const { rows }: pg.QueryResult = await pool.query(getGuideTutorialsQuery, [skill.id]);
        for (const row of rows) {
          const guideTutorial: GuideTutorial = {
            skills: [row.skill_id],
            tutorialUrls: [row.tutorial_url]
          }
          guideTutorialsInitial.push(guideTutorial);
        }
      }
      const guideTutorials = this.groupGuideTutorials(guideTutorialsInitial);
      for (const guideTutorial of guideTutorials) {
        guideTutorial.skills = this.replaceSkillsIdsWithNames(guideTutorial.skills, skills);
      }      
      response.status(200).json(guideTutorials);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getLessonSkills(subfieldId: string, subfields: Array<Subfield>): Promise<Array<Skill>> {
    let skills: Array<Skill> = [];
    for (const subfield of subfields) {
      if (subfield.id === subfieldId) {
        skills = subfield.skills as Array<Skill>;
        break;
      }
    }
    const subfieldSkills = await skillsQueries.getSkillsFromDB(subfieldId);
    const orderedSkills: Array<Skill> = []; 
    for (const subfieldSkill of subfieldSkills) {
      for (const skill of skills) {
        if (skill.id === subfieldSkill.id) {
          orderedSkills.push(skill);
          break;
        }
      }
    }
    return orderedSkills;
  }

  groupGuideTutorials(guideTutorialsInitial: Array<GuideTutorial>): Array<GuideTutorial> {
    const tutorialUrls: Array<string> = [];
    for (const guideTutorial of guideTutorialsInitial) {
      if (!tutorialUrls.includes(guideTutorial.tutorialUrls[0])) {
        tutorialUrls.push(guideTutorial.tutorialUrls[0]);
      }
    }
    return this.addGuideTutorials(guideTutorialsInitial, tutorialUrls);
  }

  addGuideTutorials(guideTutorialsInitial: Array<GuideTutorial>, tutorialUrls: Array<string>): Array<GuideTutorial> {
    const guideTutorials: Array<GuideTutorial> = [];
    for (const tutorialUrl of tutorialUrls) {
      const skillsIds: Array<string> = [];
      for (const guideTutorial of guideTutorialsInitial) {
        if (guideTutorial.tutorialUrls[0] === tutorialUrl) {
          skillsIds.push(guideTutorial.skills[0]);
        }
      }    
      let found = false;
      for (const guideTutorial of guideTutorials) {
        if (helpers.checkArraysEqual(guideTutorial.skills, skillsIds)) {
          guideTutorial.tutorialUrls.push(tutorialUrl);
          found = true;
          break;
        }
      }
      if (!found) {
        guideTutorials.push({
          skills: skillsIds,
          tutorialUrls: [tutorialUrl]
        })
      }
    }
    return guideTutorials;   
  }
  
  replaceSkillsIdsWithNames(skillsIds: Array<string>, skills: Array<Skill>): Array<string> {
    const skillsNames: Array<string> = [];
    for (const skill of skills) {
      for (const skillId of skillsIds) {
        if (skillId === skill.id) {
          skillsNames.push(skill.name);
          break;
        }
      }
    }
    return skillsNames;
  }   
  
  async setLessonPresenceMentor(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { isMentorPresent }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_mentor_present = $1 WHERE id = $2';
      await pool.query(updateLessonQuery, [isMentorPresent, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }   
}

