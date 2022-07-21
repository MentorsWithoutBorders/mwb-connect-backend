import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import InAppMessage from '../models/in_app_message';
import User from '../models/user.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class UsersInAppMessages {
  constructor() {
    autoBind(this);
  }

  async addUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { text }: InAppMessage = request.body
    try {
      await this.addUserInAppMessageFromDB(userId, text);
      response.status(200).send('In app message has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addUserInAppMessageFromDB(userId: string, text: string): Promise<void> {
    const insertInAppMessageQuery = `INSERT INTO users_in_app_messages (user_id, text)
      VALUES ($1, $2)`;
    const values = [userId, text];
    await pool.query(insertInAppMessageQuery, values);    
  }

  addUIAMLessonRequestRejected(lessonRequest: LessonRequest, text: string): void {
    const mentor = lessonRequest.mentor as User;
    const studentId = lessonRequest.student?.id;    
    const mentorName = mentor?.name;
    let mentorMessage = '';
    if (text) {
      mentorMessage = ` with the following message: "${text}"`;
    }
    const message = `We're sorry but ${mentorName} has rejected your lesson request${mentorMessage}.`
    this.addUserInAppMessageFromDB(studentId as string, message);
  }
  
  addUAIMLessonCanceled(lesson: Lesson, student: User, isCancelAll: boolean, lessonsCanceled: number): void {
    const isMentor = lesson.mentor == null ? true : false;
    if (isMentor) { // canceled by mentor
      this.addUAIMLessonCanceledStudents(lesson, isCancelAll);
    } else {
      this.addUAIMLessonCanceledMentor(lesson, student, isCancelAll, lessonsCanceled);
    }
  }
  
  addUAIMLessonCanceledStudents(lesson: Lesson, isCancelAll: boolean): void {
    let message = '';
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    let mentorMessage = '';
    if (lesson.reasonCanceled) {
      mentorMessage = ` with the following message: "${lesson.reasonCanceled}"`;
    }
    if (isLessonRecurrent && isCancelAll) {
      message = `We're sorry but the mentor has canceled the lesson recurrence${mentorMessage}`;
    } else {
      message = `We're sorry but the mentor has canceled the next lesson${mentorMessage}`;
    } 
    if (lesson.students != null) {
      for (const student of lesson.students) {
        this.addUserInAppMessageFromDB(student.id as string, message);
      }
    }
  }

  addUAIMLessonCanceledMentor(lesson: Lesson, student: User, isCancelAll: boolean, lessonsCanceled: number): void {
    let message = '';
    let studentMessage = '';
    let studentReason = '';
    if (lesson.reasonCanceled) {
      studentMessage = ` with the following message: "${lesson.reasonCanceled}"`;
      studentReason = ` for the following reason: "${lesson.reasonCanceled}"`;
    }    
    if (lessonsCanceled == 0) {
      const studentName = student.name;
      const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
      const lessonRecurrence = isLessonRecurrent && isCancelAll ? 'lesson recurrence' : 'next lesson';
      message = `${studentName} won't participate in the ${lessonRecurrence}${studentReason}`;
    } else if (lessonsCanceled == 1) {
      message = `The next lesson has been canceled by the only participant${studentMessage}`;
    } else {
      message = `The next ${lessonsCanceled} lessons have been canceled by the only participant${studentMessage}`;
    }
    if (lesson.mentor != null) {    
      this.addUserInAppMessageFromDB(lesson.mentor.id as string, message);
    }
  }  
}

