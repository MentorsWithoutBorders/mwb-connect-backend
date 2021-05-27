import User from "../../src/models/user.model";

declare global {
  namespace Express {
    interface Request {
      user: User
    }
  }
}