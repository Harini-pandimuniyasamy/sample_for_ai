import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

interface JwtPayload {
  id: string;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // 1. Check Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    // Also support token in query param for direct browser file download links
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided',
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'docuclean_ai_production_secret_key_2026';
    const decoded = jwt.verify(token, secret) as JwtPayload;

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized, user account not found',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Not authorized, invalid or expired token',
    });
    return;
  }
};
