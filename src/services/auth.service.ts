import AsyncStorage from "@react-native-async-storage/async-storage";

import { appConfig } from "../constants/app";
import { api } from "./http";

interface PayloadLogin {
  email: string;
  password: string;
}

interface MessageResponse {
  message: string;
}

interface LoginResponse extends MessageResponse {
  token?: string;
}

const extractTokenFromSetCookie = (value: string | string[] | undefined) => {
  if (!value) {
    return "";
  }

  const raw = Array.isArray(value) ? value.join(";") : value;
  const match = raw.match(/(?:^|[;,]\s*)token=([^;,\s]+)/i);

  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

const login = async (payload: PayloadLogin) => {
  const response = await api.post<LoginResponse>("/auth/login", payload);

  const setCookieHeader =
    (response.headers["set-cookie"] as string | string[] | undefined) ||
    (response.headers["Set-Cookie"] as string | string[] | undefined);

  const token =
    response.data.token || extractTokenFromSetCookie(setCookieHeader);

  if (token) {
    await AsyncStorage.setItem(appConfig.tokenStorageKey, token);
  }

  return response.data;
};

const forgotPassword = async (email: string) => {
  const { data } = await api.post<MessageResponse>("/auth/forgot-password", {
    email,
  });

  return data;
};

const checkToken = async () => {
  const { data } = await api.post<MessageResponse>("/auth/check-token");
  return data;
};

const logout = async () => {
  await AsyncStorage.removeItem(appConfig.tokenStorageKey);
};

export const AuthService = {
  login,
  forgotPassword,
  checkToken,
  logout,
};
