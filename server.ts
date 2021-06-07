import express from 'express';
import { Auth } from './src/db_queries/auth';
import { Users } from './src/db_queries/users';
import { UserGoals } from './src/db_queries/user_goals';
import { UserSteps } from './src/db_queries/user_steps';
import { UserQuizzes } from './src/db_queries/user_quizzes';
import { UserNotificationsSettings } from './src/db_queries/user_notifications_settings';
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
const userGoals: UserGoals = new UserGoals();
const userSteps: UserSteps = new UserSteps();
const userQuizzes: UserQuizzes = new UserQuizzes();
const userNotificationSettings: UserNotificationsSettings = new UserNotificationsSettings();
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

// Authentication
app.post('/api/v1/signup', auth.signUp);
app.post('/api/v1/login', auth.login);
app.post('/api/v1/logout', auth.logout);
app.get('/api/v1/access_token', auth.getAccessToken);

// Users
app.get('/api/v1/users', auth.verifyAccessToken, users.getUsers);
app.get('/api/v1/users/:id', auth.verifyAccessToken, users.getUserById);
app.put('/api/v1/users/:id', auth.verifyAccessToken, users.updateUser);
app.delete('/api/v1/users/:id', auth.verifyAccessToken, users.deleteUser);

// User goals
app.get('/api/v1/:user_id/goals', auth.verifyAccessToken, userGoals.getGoals);
app.get('/api/v1/:user_id/goals/:id', auth.verifyAccessToken, userGoals.getGoalById);
app.post('/api/v1/:user_id/goals', auth.verifyAccessToken, userGoals.addGoal);
app.put('/api/v1/goals/:id', auth.verifyAccessToken, userGoals.updateGoal);
app.delete('/api/v1/goals/:id', auth.verifyAccessToken, userGoals.deleteGoal);

// User steps
app.get('/api/v1/:goal_id/steps', auth.verifyAccessToken, userSteps.getSteps);
app.get('/api/v1/:goal_id/steps/:id', auth.verifyAccessToken, userSteps.getStepById);
app.post('/api/v1/:user_id/:goal_id/steps', auth.verifyAccessToken, userSteps.addStep);
app.put('/api/v1/steps/:id', auth.verifyAccessToken, userSteps.updateStep);
app.delete('/api/v1/steps/:id', auth.verifyAccessToken, userSteps.deleteStep);

// User quizzes
app.get('/api/v1/:user_id/quiz_number', auth.verifyAccessToken, userQuizzes.getQuizNumber);
app.post('/api/v1/:user_id/quizzes', auth.verifyAccessToken, userQuizzes.addQuiz);

// User notifications settings
app.get('/api/v1/:user_id/notifications_settings', auth.verifyAccessToken, userNotificationSettings.getNotificationsSettings);
app.put('/api/v1/:user_id/notifications_settings', auth.verifyAccessToken, userNotificationSettings.updateNotificationsSettings);

// Fields
app.get('/api/v1/fields', auth.verifyAccessToken, fields.getFields);

// Subfields
app.get('/api/v1/:field_id/subfields', auth.verifyAccessToken, subfields.getSubfields);

// Skills
app.get('/api/v1/:subfield_id/skills', auth.verifyAccessToken, skills.getSkills);

// Tutorials
app.get('/api/v1/tutorials', auth.verifyAccessToken, tutorials.getTutorials);

// Quizzes settings
app.get('/api/v1/quizzes_settings', auth.verifyAccessToken, quizzesSettings.getQuizzesSettings);

// Updates
app.get('/api/v1/updates', auth.verifyAccessToken, updates.getUpdates);


app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})