import express from 'express';
import { Auth } from './src/db_queries/auth';
import { Users } from './src/db_queries/users';
import { Fields } from './src/db_queries/fields';
import { Subfields } from './src/db_queries/subfields';
import { Skills } from './src/db_queries/skills';

const port: number = 3000;
const app: express.Express = express();
const auth: Auth = new Auth();
const users: Users = new Users();
const fields: Fields = new Fields();
const subfields: Subfields = new Subfields();
const skills: Skills = new Skills();

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
app.get('/api/v1/subfields/:field_id', auth.verifyAccessToken, subfields.getSubfields);

// Skills
app.get('/api/v1/skills/:subfield_id', auth.verifyAccessToken, skills.getSkills);

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})