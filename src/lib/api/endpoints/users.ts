import { get, mutate } from "../client";
import type { User, UserCreateBody, UserPatchBody } from "../types";

export const listUsers = (signal?: AbortSignal) => get<User[]>("/users", undefined, signal);
export const createUser = (body: UserCreateBody) => mutate<User>("POST", "/users", body);
export const updateUser = (id: string, body: UserPatchBody) =>
  mutate<User>("PATCH", `/users/${id}`, body);
