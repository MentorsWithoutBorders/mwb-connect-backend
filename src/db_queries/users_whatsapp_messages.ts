import autoBind from 'auto-bind';
import moment from 'moment';
import { createClient } from 'async-redis';
import { Client } from 'whatsapp-web.js';
import { Helpers } from '../utils/helpers';
import { constants } from '../utils/constants';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';

const helpers = new Helpers();
const redisClient = createClient();

export class UsersWhatsAppMessages {
  constructor() {
    autoBind(this);
  }

  async sendWhatsAppMessage(phoneNumber: string | undefined, message: string, whatsAppClient: Client): Promise<void> {
    if (phoneNumber) {
      const lastWMDateTime = await redisClient.get('lastWMDateTime');
      let delay = 0;
      if (lastWMDateTime) {
        if (moment.utc(lastWMDateTime).isAfter(moment.utc())) {
          await redisClient.set('lastWMDateTime', moment.utc(lastWMDateTime).add(3, 'seconds').format(constants.DATE_TIME_FORMAT));
          delay = moment.duration(moment.utc(lastWMDateTime).diff(moment.utc())).asMilliseconds() + 5000;
        } else {
          await redisClient.set('lastWMDateTime', moment.utc().add(3, 'seconds').format(constants.DATE_TIME_FORMAT));
        }
      } else {
        await redisClient.set('lastWMDateTime', moment.utc().format(constants.DATE_TIME_FORMAT));
      }
      setTimeout(() => {
        whatsAppClient.sendMessage(phoneNumber.match(/\d/g)?.join('') + '@c.us', message);
      }, delay);
    }
  }

  sendWMFirstTrainingReminder(user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number, whatsAppClient: Client): void {
    const userFirstName = helpers.getUserFirstName(user);
    let message = `Hi ${userFirstName},\r\n`;
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'Kindly remember to add a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `Kindly remember to add a new step and solve the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `Kindly remember to solve the ${quizzes} in the MWB Connect app.`;
    }
    if (showStepReminder || showQuizReminder) {    
      this.sendWhatsAppMessage(user.phoneNumber, message, whatsAppClient);
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

  sendWMSecondTrainingReminder(user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number, whatsAppClient: Client): void {
    const userFirstName = helpers.getUserFirstName(user);
    let message = `Hi ${userFirstName},\r\n`;
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'This is a gentle reminder that today is the last day for adding a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for adding a new step and solving the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for solving the ${quizzes} in the MWB Connect app.`;
    }
    if (showStepReminder || showQuizReminder) { 
      this.sendWhatsAppMessage(user.phoneNumber, message, whatsAppClient);
    }
  }    

  sendWMLessonRequestAccepted(lesson: Lesson, whatsAppClient: Client): void {
    const recurring = lesson.isRecurrent ? 'recurring ' : '';
    const mentorName = lesson.mentor?.name;
    const students = lesson.students;
    const student = students != null ? students[0] : {};
    const studentFirstName = helpers.getUserFirstName(student);
    const fieldName = student.field?.name?.toLowerCase();
    const message = `Hi ${studentFirstName},\r\n${mentorName} has scheduled a ${recurring}${fieldName} lesson with you. Please see the details in the MWB Connect app.`
    this.sendWhatsAppMessage(student.phoneNumber, message, whatsAppClient);
  }

  sendWMLessonRequestRejected(student: User, mentor: User, whatsAppClient: Client): void {
    const mentorName = mentor?.name;
    const studentFirstName = helpers.getUserFirstName(student);
    const message = `Hi ${studentFirstName},\r\nWe're sorry but ${mentorName} has rejected your lesson request. Please find a new mentor in the MWB Connect app.`;
    this.sendWhatsAppMessage(student.phoneNumber, message, whatsAppClient);
  }
  
  sendWMLessonCanceled(lesson: Lesson, isCancelAll: boolean, whatsAppClient: Client): void {
    let message = '';    
    if (lesson.isRecurrent && isCancelAll) {
      message = `We're sorry but the mentor has canceled the lesson recurrence. Please feel free to use the MWB Connect app in order to find a new mentor.`;
    } else {
      message = `We're sorry but the mentor has canceled the next lesson. If there aren't any other lessons scheduled, please feel free to use the MWB Connect app in order to find a new mentor.`;
    } 
    if (lesson.students != null) {
      for (const student of lesson.students) {
        const studentFirstName = helpers.getUserFirstName(student);
        message = `Hi ${studentFirstName},\r\n${message}`;
        this.sendWhatsAppMessage(student.phoneNumber, message, whatsAppClient);
      }
    }
  }
  
  sendWMLessonRecurrenceUpdated(students: Array<User>, whatsAppClient: Client): void {  
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        const message = `Hi ${studentFirstName},\r\nThe mentor has updated the lesson recurrence. Please see the new details in the MWB Connect app.`;
        this.sendWhatsAppMessage(student.phoneNumber, message, whatsAppClient);
      }
    }
  }

  sendWMLessonReminder(nextLesson: Lesson, whatsAppClient: Client): void {
    const students = nextLesson.students;
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        const message = `Hi ${studentFirstName},\r\nKindly remember to attend the lesson in 30 mins from now.`;
        this.sendWhatsAppMessage(student.phoneNumber, message, whatsAppClient);
      }
    }
  }  
}

