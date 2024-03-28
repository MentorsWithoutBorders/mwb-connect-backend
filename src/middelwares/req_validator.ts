import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'yup';

export const reqValidator =
  ({
    paramSchema,
    bodySchema
  }: {
    paramSchema?: Schema;
    bodySchema?: Schema;
  }) =>
  (req: Request, res: Response, next: NextFunction) => {
    const { params, body } = req;
    try {
      if (paramSchema) {
        paramSchema.validateSync(params);
      }

      if (bodySchema) {
        bodySchema.validateSync(body);
      }

      next();
    } catch (error: unknown) {
      res.status(400).json({ error: (error as ValidationError).message });
    }
  };
