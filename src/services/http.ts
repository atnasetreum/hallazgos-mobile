import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { appConfig } from "../constants/app";
import { notify } from "../utils";

const DEFAULT_ERROR_MESSAGE =
  "Se produjo un error al procesar su solicitud, inténtelo nuevamente más tarde.";

interface ErrorResponse {
  message?: string;
}

export const api = axios.create({
  baseURL: appConfig.apiUrl,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);

  config.headers.Accept = "application/json";
  config.headers["Content-Type"] = "application/json";
  config.headers["x-app-key"] = appConfig.appKey;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const message = error?.response?.data?.message || DEFAULT_ERROR_MESSAGE;
    notify(message);
    return Promise.reject(error);
  },
);
