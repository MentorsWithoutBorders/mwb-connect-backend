import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class Helpers {
  hashPassword(password: string) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
  }

  comparePassword(hashPassword: string, password: string) {
    return bcrypt.compareSync(password, hashPassword);
  }

  isValidEmail(email:string ) {
    return /\S+@\S+\.\S+/.test(email);
  }

  generateAccessToken(id: string) {
    return jwt.sign({
      userId: id
    },
      'super-secret', { expiresIn: '1h' }
    );
  }

  generateRefreshToken(id: string) {
    return uuidv4();
  }
}
