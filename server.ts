import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { Auth } from './src/db_queries/auth';
import { Users } from './src/db_queries/users';
import { UsersGoals } from './src/db_queries/users_goals';
import { UsersSteps } from './src/db_queries/users_steps';
import { UsersQuizzes } from './src/db_queries/users_quizzes';
import { UsersLessonRequests } from './src/db_queries/users_lesson_requests';
import { UsersLessons } from './src/db_queries/users_lessons';
import { UsersSkills } from './src/db_queries/users_skills';
import { UsersNotificationsSettings } from './src/db_queries/users_notifications_settings';
import { UsersSupportRequests } from './src/db_queries/users_support_requests';
import { Fields } from './src/db_queries/fields';
import { Subfields } from './src/db_queries/subfields';
import { Skills } from './src/db_queries/skills';
import { Tutorials } from './src/db_queries/tutorials';
import { QuizzesSettings } from './src/db_queries/quizzes_settings';
import { Updates } from './src/db_queries/updates';

const port = 3000;
const app: express.Express = express();
const auth: Auth = new Auth();
const users: Users = new Users();
const usersGoals: UsersGoals = new UsersGoals();
const usersSteps: UsersSteps = new UsersSteps();
const usersQuizzes: UsersQuizzes = new UsersQuizzes();
const usersLessonRequests: UsersLessonRequests = new UsersLessonRequests();
const usersLessons: UsersLessons = new UsersLessons();
const usersSkills: UsersSkills = new UsersSkills();
const usersNotificationsSettings: UsersNotificationsSettings = new UsersNotificationsSettings();
const usersSupportRequests: UsersSupportRequests = new UsersSupportRequests();
const fields: Fields = new Fields();
const subfields: Subfields = new Subfields();
const skills: Skills = new Skills();
const tutorials: Tutorials = new Tutorials();
const quizzesSettings: QuizzesSettings = new QuizzesSettings();
const updates: Updates = new Updates();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (request: express.Request, response: express.Response): void => {
  response.json({ info: 'Node.js, Express, and Postgres API' })
})

const verifyAccessTokenFilter = function(request: Request, response: Response, next: NextFunction): void {
  if (['signup', 'login', 'logout', 'access_token'].some(route => request.originalUrl.includes(route))) {
    next();
  } else {
    auth.verifyAccessToken(request, response, next);
  }
}

app.use(verifyAccessTokenFilter);

// Authentication
app.post('/api/v1/signup', auth.signUp);
app.post('/api/v1/login', auth.login);
app.post('/api/v1/users/:id/logout', auth.logout);
app.get('/api/v1/users/:id/access_token', auth.getAccessToken);

// Users
app.get('/api/v1/users', users.getUsers);
app.get('/api/v1/users/:id', users.getUserById);
app.put('/api/v1/users/:id', users.updateUser);
app.delete('/api/v1/users/:id', users.deleteUser);

// Users goals
app.get('/api/v1/users/:id/goals', usersGoals.getGoals);
app.get('/api/v1/goals/:id', usersGoals.getGoalById);
app.post('/api/v1/users/:id/goals', usersGoals.addGoal);
app.put('/api/v1/users/:user_id/goals/:id', usersGoals.updateGoal);
app.delete('/api/v1/goals/:id', usersGoals.deleteGoal);

// Users steps
app.get('/api/v1/goals/:id/steps', usersSteps.getSteps);
app.get('/api/v1/steps/:id', usersSteps.getStepById);
app.post('/api/v1/users/:user_id/goals/:goal_id/steps', usersSteps.addStep);
app.put('/api/v1/users/:user_id/steps/:id', usersSteps.updateStep);
app.delete('/api/v1/steps/:id', usersSteps.deleteStep);
app.get('/api/v1/users/:id/last_step_added', usersSteps.getLastStepAdded);

// Users quizzes
app.get('/api/v1/users/:id/quiz_number', usersQuizzes.getQuizNumber);
app.post('/api/v1/users/:id/quizzes', usersQuizzes.addQuiz);

// Users lesson requests
app.post('/api/v1/users/:id/lesson_requests', usersLessonRequests.addLessonRequest);
app.get('/api/v1/users/:id/lesson_request', usersLessonRequests.getLessonRequest);
app.post('/api/v1/lesson_requests/:id/accept_lesson_request', usersLessonRequests.acceptLessonRequest);
app.put('/api/v1/lesson_requests/:id/reject_lesson_request', usersLessonRequests.rejectLessonRequest);
app.put('/api/v1/lesson_requests/:id/cancel_lesson_request', usersLessonRequests.cancelLessonRequest);

// Users lessons
app.get('/api/v1/users/:id/next_lesson', usersLessons.getNextLesson);
app.get('/api/v1/users/:id/previous_lesson', usersLessons.getPreviousLesson);
app.put('/api/v1/users/:user_id/lessons/:lesson_id/cancel_lesson', usersLessons.cancelLesson);
app.put('/api/v1/lessons/:id/change_meeting_url', usersLessons.setLessonMeetingUrl);
app.put('/api/v1/lessons/:id/update_recurrence', usersLessons.setLessonRecurrence);
app.put('/api/v1/lessons/:id/mentor_presence', usersLessons.setLessonPresenceMentor);

// Users skills
app.get('/api/v1/users/:user_id/subfields/:subfield_id/skills', usersSkills.getUserSkills);
app.post('/api/v1/users/:user_id/subfields/:subfield_id/skills', usersSkills.addUserSkills);

// Users notifications settings
app.get('/api/v1/users/:id/notifications_settings', usersNotificationsSettings.getNotificationsSettings);
app.put('/api/v1/users/:id/notifications_settings', usersNotificationsSettings.updateNotificationsSettings);

// Users support requests
app.post('/api/v1/users/:id/support_requests', usersSupportRequests.addSupportRequest);

// Fields
app.get('/api/v1/fields', fields.getFields);

// Subfields
app.get('/api/v1/fields/:id/subfields', subfields.getSubfields);

// Skills
app.get('/api/v1/subfields/:id/skills', skills.getSkills);

// Tutorials
app.get('/api/v1/tutorials', tutorials.getTutorials);

// Quizzes settings
app.get('/api/v1/quizzes_settings', quizzesSettings.getQuizzesSettings);

// Updates
app.get('/api/v1/updates', updates.getUpdates);


app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})