import type { Request } from "express";

export interface AuthContext {
  userId: string;
  email: string;
}

export interface SynodRequest extends Request {
  auth?: AuthContext;
}
