import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { Request, Response, NextFunction } from 'express';
import { Auth } from './src/db_queries/auth';
import { ApprovedUsers } from './src/db_queries/approved_users';
import { Users } from './src/db_queries/users';
import { UsersResetPassword } from './src/db_queries/users_reset_password';
import { UsersTimeZones } from './src/db_queries/users_timezones';
import { UsersGoals } from './src/db_queries/users_goals';
import { UsersSteps } from './src/db_queries/users_steps';
import { UsersQuizzes } from './src/db_queries/users_quizzes';
import { UsersAvailableMentors } from './src/db_queries/users_available_mentors';
import { UsersLessonRequests } from './src/db_queries/users_lesson_requests';
import { UsersLessons } from './src/db_queries/users_lessons';
import { UsersCertificatesPauses } from './src/db_queries/users_certificates_pauses';
import { UsersSkills } from './src/db_queries/users_skills';
import { UsersNotificationsSettings } from './src/db_queries/users_notifications_settings';
import { UsersSupportRequests } from './src/db_queries/users_support_requests';
import { UsersPushNotifications } from './src/db_queries/users_push_notifications';
import { UsersAppVersions } from './src/db_queries/users_app_versions';
import { UsersAppFlags } from './src/db_queries/users_app_flags';
import { UsersBackgroundProcesses } from './src/db_queries/users_background_processes';
import { Organizations } from './src/db_queries/organizations';
import { Fields } from './src/db_queries/fields';
import { Subfields } from './src/db_queries/subfields';
import { Skills } from './src/db_queries/skills';
import { FieldsGoals } from './src/db_queries/fields_goals';
import { Tutorials } from './src/db_queries/tutorials';
import { QuizzesSettings } from './src/db_queries/quizzes_settings';
import { Updates } from './src/db_queries/updates';
import { Logger } from './src/db_queries/logger';
import { AdminStudentsCertificates } from './src/db_queries/admin_students_certificates';
import { AdminTrainingReminders } from './src/db_queries/admin_training_reminders';
import { AdminLessons } from './src/db_queries/admin_lessons';
import { AdminAvailableMentors } from './src/db_queries/admin_available_mentors';
import { AdminAvailableStudents } from './src/db_queries/admin_available_students';

dotenv.config();
const whatsAppClient = new Client({
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },
  authStrategy: new LocalAuth()  
});
const port = process.env.PORT;
const app: express.Express = express();
const auth: Auth = new Auth();
const users: Users = new Users();
const approvedUsers: ApprovedUsers = new ApprovedUsers();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();
const usersResetPassword: UsersResetPassword = new UsersResetPassword();
const usersPushNotifications: UsersPushNotifications = new UsersPushNotifications();
const usersGoals: UsersGoals = new UsersGoals();
const usersSteps: UsersSteps = new UsersSteps();
const usersQuizzes: UsersQuizzes = new UsersQuizzes();
const usersAvailableMentors: UsersAvailableMentors = new UsersAvailableMentors();
const usersLessonRequests: UsersLessonRequests = new UsersLessonRequests();
const usersLessons: UsersLessons = new UsersLessons();
const usersCertificatesPauses: UsersCertificatesPauses = new UsersCertificatesPauses();
const usersSkills: UsersSkills = new UsersSkills();
const usersNotificationsSettings: UsersNotificationsSettings = new UsersNotificationsSettings();
const usersSupportRequests: UsersSupportRequests = new UsersSupportRequests();
const usersAppVersions: UsersAppVersions = new UsersAppVersions();
const usersAppFlags: UsersAppFlags = new UsersAppFlags();
const usersBackgroundProcesses: UsersBackgroundProcesses = new UsersBackgroundProcesses();
const organizations: Organizations = new Organizations();
const fields: Fields = new Fields();
const subfields: Subfields = new Subfields();
const skills: Skills = new Skills();
const fieldsGoals: FieldsGoals = new FieldsGoals();
const tutorials: Tutorials = new Tutorials();
const quizzesSettings: QuizzesSettings = new QuizzesSettings();
const updates: Updates = new Updates();
const logger: Logger = new Logger();
const adminStudentsCertificates: AdminStudentsCertificates = new AdminStudentsCertificates();
const adminTrainingReminders: AdminTrainingReminders = new AdminTrainingReminders();
const adminLessons: AdminLessons = new AdminLessons();
const adminAvailableMentors: AdminAvailableMentors = new AdminAvailableMentors();
const adminAvailableStudents: AdminAvailableStudents = new AdminAvailableStudents();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get('/', (request: express.Request, response: express.Response): void => {
  response.json({ info: 'Node.js, Express, and Postgres API' })
})

whatsAppClient.on('qr', (qr) => {
  qrcode.generate(qr, {small: true});
});

whatsAppClient.on('ready', () => {
  console.log('WhatsApp client is ready!');
});

whatsAppClient.initialize();

const verifyAccessTokenFilter = function(request: Request, response: Response, next: NextFunction): void {
  if (request.originalUrl.includes('/logger')) {
    if (request.headers.authorization) {
      auth.verifyAccessToken(request, response, next);      
    } else {
      next();
    }
  } else if (['/approved_user', '/organizations', '/signup', '/login', '/access_token', '/send_reset_password', '/reset_password', '/tutorials', '/quizzes_settings'].some(route => request.originalUrl.includes(route))) {
    next();
  } else {
    auth.verifyAccessToken(request, response, next);
  }
}

app.use(verifyAccessTokenFilter);

// Approved users
app.post('/api/v1/approved_user', approvedUsers.addApprovedUser);

// Authentication
app.post('/api/v1/signup', auth.signUp);
app.post('/api/v1/login', auth.login);
app.post('/api/v1/logout', auth.logout);
app.get('/api/v1/users/:id/access_token', auth.getAccessToken);

// Users reset password
app.post('/api/v1/send_reset_password/:email', usersResetPassword.addUserResetPassword);
app.post('/api/v1/reset_password', usersResetPassword.resetPassword);

// Users
app.get('/api/v1/user', users.getUser);
app.put('/api/v1/user', users.updateUser);
app.delete('/api/v1/user', users.deleteUser);

// Users FCM tokens
app.post('/api/v1/fcm_tokens', usersPushNotifications.addFCMToken);

// Users timezones
app.put('/api/v1/timezones', usersTimeZones.updateTimeZone);

// Users goals
app.get('/api/v1/goals', usersGoals.getGoals);
app.get('/api/v1/goals/:id', usersGoals.getGoalById);
app.post('/api/v1/goals', usersGoals.addGoal);
app.put('/api/v1/goals/:id', usersGoals.updateGoal);
app.delete('/api/v1/goals/:id', usersGoals.deleteGoal);

// Users steps
app.get('/api/v1/goals/:id/steps', usersSteps.getSteps);
app.get('/api/v1/steps/:id', usersSteps.getStepById);
app.post('/api/v1/goals/:id/steps', usersSteps.addStep);
app.put('/api/v1/steps/:id', usersSteps.updateStep);
app.delete('/api/v1/steps/:id', usersSteps.deleteStep);
app.get('/api/v1/last_step_added', usersSteps.getLastStepAdded);

// Users quizzes
app.get('/api/v1/quizzes', usersQuizzes.getQuizzes);
app.get('/api/v1/quiz_number', usersQuizzes.getQuizNumber);
app.post('/api/v1/quizzes', usersQuizzes.addQuiz);

// Users available mentors
app.post('/api/v1/available_mentors', usersAvailableMentors.getAvailableMentors);
app.get('/api/v1/available_mentors/fields', usersAvailableMentors.getAvailableMentorsFields);

// Users lesson requests
app.post('/api/v1/lesson_requests', usersLessonRequests.addLessonRequest);
app.get('/api/v1/lesson_request', usersLessonRequests.getLessonRequest);
app.post('/api/v1/lesson_requests/send_custom_lesson_request', usersLessonRequests.sendCustomLessonRequest);
app.post('/api/v1/lesson_requests/:id/accept_lesson_request', usersLessonRequests.acceptLessonRequest);
app.put('/api/v1/lesson_requests/:id/reject_lesson_request', usersLessonRequests.rejectLessonRequest);
app.put('/api/v1/lesson_requests/:id/cancel_lesson_request', usersLessonRequests.cancelLessonRequest);
app.put('/api/v1/lesson_requests/:id/update_lesson_request', usersLessonRequests.updateLessonRequest);

// Users lessons
app.get('/api/v1/next_lesson', usersLessons.getNextLesson);
app.get('/api/v1/previous_lesson', usersLessons.getPreviousLesson);
app.put('/api/v1/lessons/:id/cancel_lesson', usersLessons.cancelLesson);
app.put('/api/v1/lessons/:id/meeting_url', usersLessons.setLessonMeetingUrl);
app.put('/api/v1/lessons/:id/recurrence', usersLessons.setLessonRecurrence);
app.put('/api/v1/lessons/:id/skills', usersLessons.addStudentsSkills);
app.post('/api/v1/lessons/:id/notes', usersLessons.addStudentsLessonNotes);
app.get('/api/v1/users/:id/lessons_notes', usersLessons.getStudentLessonNotes);
app.get('/api/v1/lessons/:id/guide_tutorials', usersLessons.getLessonGuideTutorials);
app.get('/api/v1/lessons/:id/guide_recommendations', usersLessons.getLessonGuideRecommendations);
app.put('/api/v1/lessons/:id/mentor_presence', usersLessons.setLessonPresenceMentor);

// Users certificates pauses
app.get('/api/v1/certificate_pause', usersCertificatesPauses.getUserCertificatePause);
app.post('/api/v1/certificate_pause', usersCertificatesPauses.addUserCertificatePause);

// Users skills
app.get('/api/v1/users/:user_id/subfields/:subfield_id/skills', usersSkills.getUserSkills);
app.post('/api/v1/user/subfields/:id/skills', usersSkills.addUserSkills);

// Users notifications settings
app.get('/api/v1/notifications_settings', usersNotificationsSettings.getNotificationsSettings);
app.put('/api/v1/notifications_settings', usersNotificationsSettings.updateNotificationsSettings);

// Users support requests
app.post('/api/v1/support_requests', usersSupportRequests.addSupportRequest);

// Users app flags
app.get('/api/v1/app_flags', usersAppFlags.getAppFlags);

// Organizations
app.get('/api/v1/organizations/id/:id', organizations.getOrganizationById);
app.get('/api/v1/organizations/name/:name', organizations.getOrganizationByName);

// Fields
app.get('/api/v1/fields', fields.getFields);
app.get('/api/v1/fields_goals', fieldsGoals.getFieldsGoals);
app.get('/api/v1/fields/:id', fields.getFieldById);
app.post('/api/v1/fields', fields.addField);
app.put('/api/v1/fields/:id', fields.updateField);
app.delete('/api/v1/fields/:id', fields.deleteField);

// Subfields
app.get('/api/v1/fields/:id/subfields', subfields.getSubfields);
app.get('/api/v1/subfields/:id', subfields.getSubfieldById);
app.post('/api/v1/fields/:id/subfields', subfields.addSubfield);
app.put('/api/v1/subfields/:id', subfields.updateSubfield);
app.delete('/api/v1/subfields/:id', subfields.deleteSubfield);

// Skills
app.get('/api/v1/subfields/:id/skills', skills.getSkills);
app.get('/api/v1/skills/:id', skills.getSkillById);
app.post('/api/v1/subfields/:id/skills', skills.addSkill);
app.put('/api/v1/skills/:id', skills.updateSkill);
app.delete('/api/v1/skills/:id', skills.deleteSkill);

// Tutorials
app.get('/api/v1/tutorials', tutorials.getTutorials);

// Quizzes settings
app.get('/api/v1/quizzes_settings', quizzesSettings.getQuizzesSettings);

// Updates
app.get('/api/v1/updates', updates.getUpdates);

// Users app versions
app.post('/api/v1/app_versions', usersAppVersions.addAppVersion);

// Logger
app.post('/api/v1/logger', logger.addLogEntry);

const sendTrainingReminders = (request: Request, response: Response) => {
  usersBackgroundProcesses.sendTrainingReminders(request, response, whatsAppClient);
}

// Users background processes
app.post('/api/v1/send_lesson_reminders', usersBackgroundProcesses.sendLessonReminders);
app.post('/api/v1/send_after_lessons', usersBackgroundProcesses.sendAfterLesson);
app.post('/api/v1/send_training_reminders', sendTrainingReminders);
app.post('/api/v1/available_mentors/fields', usersBackgroundProcesses.setAvailableMentorsFields);

cron.schedule('* * * * *', function() {
  usersBackgroundProcesses.sendLessonRemindersFromDB();
  usersBackgroundProcesses.sendAfterLessonFromDB();
  usersBackgroundProcesses.sendTrainingRemindersFromDB(true);
  usersBackgroundProcesses.sendTrainingRemindersFromDB(false);
  usersBackgroundProcesses.sendCPUUsage();
});

cron.schedule("*/5 * * * *", function() {
  usersAvailableMentors.setAvailableMentorsFieldsFromDB();
});


// Admin students certificates
app.get('/api/v1/admin/students_certificates', adminStudentsCertificates.getStudentsCertificates);
app.get('/api/v1/admin/students_certificates/certificate_sent', adminStudentsCertificates.getCertificateSent);
app.put('/api/v1/admin/students_certificates/:student_id/certificate_sent', adminStudentsCertificates.updateCertificateSent);

// Admin training reminders
app.get('/api/v1/admin/training_reminders', adminTrainingReminders.getTrainingReminders);
app.get('/api/v1/admin/all_training_reminders', adminTrainingReminders.getAllTrainingReminders);
app.get('/api/v1/admin/:trainer_id/training_reminders', adminTrainingReminders.getTrainingReminders);
app.get('/api/v1/admin/:trainer_id/all_training_reminders', adminTrainingReminders.getAllTrainingReminders);
app.get('/api/v1/admin/trainers', adminTrainingReminders.getTrainers);
app.post('/api/v1/admin/conversations', adminTrainingReminders.addConversation);
app.put('/api/v1/admin/training_reminders/:id/last_contacted', adminTrainingReminders.updateLastContacted);

// Admin lessons
app.get('/api/v1/admin/lessons', adminLessons.getLessons);

// Admin available mentors
app.get('/api/v1/admin/available_mentors_lessons', adminAvailableMentors.getAvailableMentorsLessons);
app.put('/api/v1/admin/available_mentors/:mentor_id/should_contact', adminAvailableMentors.updateShouldContact);

// Admin available students
app.get('/api/v1/admin/available_students_lessons', adminAvailableStudents.getAvailableStudentsLessons);
app.put('/api/v1/admin/available_students/:student_id/should_contact', adminAvailableStudents.updateShouldContact);


app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})