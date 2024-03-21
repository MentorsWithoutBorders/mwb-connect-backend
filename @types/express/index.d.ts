import User from '../../src/models/user.model';

declare global {
  namespace Express {
    interface Request {
      user: UserType;
    }
  }
}

type UserType = Pick<
  User,
  'id' | 'isOrgManager' | 'isAdmin' | 'isCenterManager'
> & { orgId?: string };
