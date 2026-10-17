import { get, mutate } from "../client";
import type { ChangePasswordBody, LoginBody, User } from "../types";

export const login = (body: LoginBody) => mutate<User>("POST", "/auth/login", body);
export const me = (signal?: AbortSignal) => get<User>("/auth/me", undefined, signal);
export const logout = () => mutate<void>("POST", "/auth/logout");
export const changePassword = (body: ChangePasswordBody) =>
  mutate<void>("POST", "/auth/change-password", body);
