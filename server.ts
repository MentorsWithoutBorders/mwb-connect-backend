import express from 'express';
import { Auth } from './src/db_queries/auth';
import { Users } from './src/db_queries/users';
import { UsersGoals } from './src/db_queries/users_goals';
import { UsersSteps } from './src/db_queries/users_steps';
import { UsersQuizzes } from './src/db_queries/users_quizzes';
import { UsersSupportRequests } from './src/db_queries/users_support_requests';
import { UsersNotificationsSettings } from './src/db_queries/users_notifications_settings';
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

// Authentication
app.post('/api/v1/signup', auth.signUp);
app.post('/api/v1/login', auth.login);
app.post('/api/v1/users/:id/logout', auth.logout);
app.get('/api/v1/users/:id/access_token', auth.getAccessToken);

// Users
app.get('/api/v1/users', auth.verifyAccessToken, users.getUsers);
app.get('/api/v1/users/:id', auth.verifyAccessToken, users.getUserById);
app.put('/api/v1/users/:id', auth.verifyAccessToken, users.updateUser);
app.delete('/api/v1/users/:id', auth.verifyAccessToken, users.deleteUser);

// User goals
app.get('/api/v1/users/:id/goals', auth.verifyAccessToken, usersGoals.getGoals);
app.get('/api/v1/goals/:id', auth.verifyAccessToken, usersGoals.getGoalById);
app.post('/api/v1/users/:id/goals', auth.verifyAccessToken, usersGoals.addGoal);
app.put('/api/v1/users/:user_id/goals/:id', auth.verifyAccessToken, usersGoals.updateGoal);
app.delete('/api/v1/goals/:id', auth.verifyAccessToken, usersGoals.deleteGoal);

// User steps
app.get('/api/v1/goals/:id/steps', auth.verifyAccessToken, usersSteps.getSteps);
app.get('/api/v1/steps/:id', auth.verifyAccessToken, usersSteps.getStepById);
app.post('/api/v1/users/:user_id/goals/:goal_id/steps', auth.verifyAccessToken, usersSteps.addStep);
app.put('/api/v1/users/:user_id/steps/:id', auth.verifyAccessToken, usersSteps.updateStep);
app.delete('/api/v1/steps/:id', auth.verifyAccessToken, usersSteps.deleteStep);

// User quizzes
app.get('/api/v1/users/:id/quiz_number', auth.verifyAccessToken, usersQuizzes.getQuizNumber);
app.post('/api/v1/users/:id/quizzes', auth.verifyAccessToken, usersQuizzes.addQuiz);

// User notifications settings
app.get('/api/v1/users/:id/notifications_settings', auth.verifyAccessToken, usersNotificationsSettings.getNotificationsSettings);
app.put('/api/v1/users/:id/notifications_settings', auth.verifyAccessToken, usersNotificationsSettings.updateNotificationsSettings);

// Users support requests
app.post('/api/v1/users/:id/support_requests', auth.verifyAccessToken, usersSupportRequests.addSupportRequest);

// Fields
app.get('/api/v1/fields', auth.verifyAccessToken, fields.getFields);

// Subfields
app.get('/api/v1/fields/:id/subfields', auth.verifyAccessToken, subfields.getSubfields);

// Skills
app.get('/api/v1/subfields/:id/skills', auth.verifyAccessToken, skills.getSkills);

// Tutorials
app.get('/api/v1/tutorials', auth.verifyAccessToken, tutorials.getTutorials);

// Quizzes settings
app.get('/api/v1/quizzes_settings', auth.verifyAccessToken, quizzesSettings.getQuizzesSettings);

// Updates
app.get('/api/v1/updates', auth.verifyAccessToken, updates.getUpdates);


app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})