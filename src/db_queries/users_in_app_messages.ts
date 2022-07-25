import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
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

  async getUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const inAppMessage = await this.getUserInAppMessageFromDB(userId);
      response.status(200).json(inAppMessage);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
  
  async getUserInAppMessageFromDB(userId: string): Promise<InAppMessage> {
    const getUserInAppMessageQuery = 'SELECT text FROM users_in_app_messages WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserInAppMessageQuery, [userId]);
    let inAppMessage: InAppMessage = {};
    if (rows[0]) {
      inAppMessage = {
        userId: userId,
        text: rows[0].text
      }
    }
    return inAppMessage;
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
  
  async addUserInAppMessageFromDB(userId: string, text: string | undefined): Promise<void> {
    const insertInAppMessageQuery = `INSERT INTO users_in_app_messages (user_id, text)
      VALUES ($1, $2)`;
    const values = [userId, text];
    await pool.query(insertInAppMessageQuery, values);    
  }

  async deleteUserInAppMessage(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      await this.deleteUserInAppMessageFromDB(userId);
      response.status(200).json('In-app message has been deleted successfully');
    } catch (error) {
      response.status(400).send(error);
    } 
  }
  
  async deleteUserInAppMessageFromDB(userId: string): Promise<void> {
    const deleteUserInAppMessageQuery = 'DELETE FROM users_in_app_messages WHERE user_id = $1';
    await pool.query(deleteUserInAppMessageQuery, [userId]);
  }
  
  addUIAMFirstTrainingReminder(userId: string, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
    let message = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message = 'Kindly remember to add a new step to your plan.';
    } else if (showStepReminder && showQuizReminder) {
      message = `Kindly remember to add a new step and solve the ${quizzes}.`;
    } else if (!showStepReminder && showQuizReminder) {
      message = `Kindly remember to solve the ${quizzes}.`;
    }
    if (showStepReminder || showQuizReminder) {    
      this.addUserInAppMessageFromDB(userId, message);
    }
  }
  
  getRemainingQuizzesText(remainingQuizzes: number): string {
    let quizzes = '';
    switch(remainingQuizzes) {
      case 1:
        quizzes = 'remaining quiz';
        break;
      case 3:
        quizzes = 'training quizzes';
        break;
      default:
        quizzes = `remaining ${remainingQuizzes} quizzes`;
    }
    return quizzes;    
  }

  addUIAMLastTrainingReminder(userId: string, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
    let message = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message = 'This is a gentle reminder that today is the last day for adding a new step to your plan.';
    } else if (showStepReminder && showQuizReminder) {
      message = `This is a gentle reminder that today is the last day for adding a new step to your plan and for solving the ${quizzes}.`;
    } else if (!showStepReminder && showQuizReminder) {
      message = `This is a gentle reminder that today is the last day for solving the ${quizzes}.`;
    }
    if (showStepReminder || showQuizReminder) {    
      this.addUserInAppMessageFromDB(userId, message);
    }
  }

  addUIAMLessonRequestReminder(lessonRequest: LessonRequest): void {
    const mentorId = lessonRequest.mentor?.id as string;
    const student = lessonRequest.student as User;    
    const studentFirstName = helpers.getUserFirstName(student);
    const message = `Kindly remember to accept or reject ${studentFirstName}'s lesson request until the end of the day today so that the student can connect with another mentor if needed.`;
    this.addUserInAppMessageFromDB(mentorId, message);
  }

  addUIAMLessonRequestRejected(lessonRequest: LessonRequest, text: string | undefined): void {
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

  addUIAMLessonRequestExpired(lessonRequest: LessonRequest): void {
    const mentor = lessonRequest.mentor as User;
    const studentId = lessonRequest.student?.id;
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const message = `We're sorry but your lesson request has expired due to ${mentorFirstName}'s unavailability. Please find a new mentor.`;
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
      message = `We're sorry but the mentor has canceled the lesson recurrence${mentorMessage}.`;
    } else {
      message = `We're sorry but the mentor has canceled the next lesson${mentorMessage}.`;
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
      message = `${studentName} won't participate in the ${lessonRecurrence}${studentReason}.`;
    } else if (lessonsCanceled == 1) {
      message = `The next lesson has been canceled by the only participant${studentMessage}.`;
    } else {
      message = `The next ${lessonsCanceled} lessons have been canceled by the only participant${studentMessage}.`;
    }
    if (lesson.mentor != null) {    
      this.addUserInAppMessageFromDB(lesson.mentor.id as string, message);
    }
  }

  addUIAMFirstAddLessonsReminder(lesson: Lesson): void {
    const students = lesson?.students;
    const studentsText = students?.length == 1 ? 'student' : 'students';
    const message = `Kindly remember to add more lessons with your previous ${studentsText} if possible.`;
    const mentor = lesson.mentor;
    this.addUserInAppMessageFromDB(mentor?.id as string, message);
  }

  addUIAMLastAddLessonsReminder(lesson: Lesson): void {
    const students = lesson?.students;
    const studentsText = students?.length == 1 ? 'student' : 'students';
    const message = `Kindly remember to add more lessons (if possible) with your previous ${studentsText} until the end of the day today.`
    const mentor = lesson.mentor;
    this.addUserInAppMessageFromDB(mentor?.id as string, message);
  }
  
  addUIAMNoMoreLessonsAdded(mentor: User, student: User): void {
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const message = `We're sorry but ${mentorFirstName} couldn't schedule more lessons. Please find a new mentor.`;
    this.addUserInAppMessageFromDB(student.id as string, message);
  }
}

