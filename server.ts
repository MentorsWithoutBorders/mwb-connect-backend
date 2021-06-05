import express from 'express';
import { Auth } from './src/db_queries/auth';
import { Users } from './src/db_queries/users';
import { Fields } from './src/db_queries/fields';
import { Subfields } from './src/db_queries/subfields';
import { Skills } from './src/db_queries/skills';
import { Goals } from './src/db_queries/goals';
import { Steps } from './src/db_queries/steps';

const port = 3000;
const app: express.Express = express();
const auth: Auth = new Auth();
const users: Users = new Users();
const fields: Fields = new Fields();
const subfields: Subfields = new Subfields();
const skills: Skills = new Skills();
const goals: Goals = new Goals();
const steps: Steps = new Steps();

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

// Fields
app.get('/api/v1/fields', auth.verifyAccessToken, fields.getFields);

// Subfields
app.get('/api/v1/:field_id/subfields', auth.verifyAccessToken, subfields.getSubfields);

// Skills
app.get('/api/v1/:subfield_id/skills', auth.verifyAccessToken, skills.getSkills);

// Users goals
app.get('/api/v1/:user_id/goals', auth.verifyAccessToken, goals.getGoals);
app.get('/api/v1/:user_id/goals/:id', auth.verifyAccessToken, goals.getGoalById);
app.post('/api/v1/:user_id/goals', auth.verifyAccessToken, goals.addGoal);
app.put('/api/v1/goals/:id', auth.verifyAccessToken, goals.updateGoal);
app.delete('/api/v1/goals/:id', auth.verifyAccessToken, goals.deleteGoal);

// Users steps
app.get('/api/v1/:goal_id/steps', auth.verifyAccessToken, steps.getSteps);
app.get('/api/v1/:goal_id/steps/:id', auth.verifyAccessToken, steps.getStepById);
app.post('/api/v1/:user_id/:goal_id/steps', auth.verifyAccessToken, steps.addStep);
app.put('/api/v1/steps/:id', auth.verifyAccessToken, steps.updateStep);
app.delete('/api/v1/steps/:id', auth.verifyAccessToken, steps.deleteStep);

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})