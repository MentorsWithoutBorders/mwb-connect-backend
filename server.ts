import express from 'express';
import { Auth } from './db_queries/auth';
import { Users } from './db_queries/users';
import { Fields } from './db_queries/fields';

const port: number = 3000;
const app: express.Express = express();
const auth: Auth = new Auth();
const users: Users = new Users();
const fields: Fields = new Fields();

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

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})