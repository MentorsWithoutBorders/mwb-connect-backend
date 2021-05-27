import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

export class Helpers {
  hashPassword(password: string): string {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
  }

  comparePassword(hashPassword: string, password: string): boolean {
    return bcrypt.compareSync(password, hashPassword);
  }

  isValidEmail(email:string ): boolean {
    return /\S+@\S+\.\S+/.test(email);
  }

  generateAccessToken(id: string): string {
    return jwt.sign({
      userId: id
    },
      process.env.JWT_SECRET_KEY as string, { expiresIn: '1h' }
    );
  }

  generateRefreshToken(): string {
    return uuidv4();
  }
}
