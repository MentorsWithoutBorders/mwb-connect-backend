import express from 'express';
import { Auth } from './db_queries/auth';
import { Users } from './db_queries/users';

const port: number = 3000;
const app: express.Express = express();
const auth: Auth = new Auth();
const db: Users = new Users();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (request: express.Request, response: express.Response): void => {
  response.json({ info: 'Node.js, Express, and Postgres API' })
})

app.post('/api/v1/login', db.loginUser);
app.post('/api/v1/signup', db.createUser);
app.get('/api/v1/access_token', auth.getAccessToken);
app.post('/api/v1/logout', db.logoutUser);
app.get('/api/v1/users', auth.verifyAccessToken, db.getUsers);
app.get('/api/v1/users/:id', db.getUserById);
app.put('/api/v1/users/:id', db.updateUser);
app.delete('/api/v1/users/:id', db.deleteUser);

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
})