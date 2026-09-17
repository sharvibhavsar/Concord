export * from "./generated/api";
import * as zod from 'zod';
import { GetCurrentAuthUserResponse } from './generated/api';

export type AuthUser = Exclude<zod.infer<typeof GetCurrentAuthUserResponse>["user"], null>;
