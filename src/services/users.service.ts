import { api } from "./http";
import { SupervisorUser, UserSession } from "../types/hallazgos";

const getInformationCurrentUser = async () => {
  const { data } = await api.get<UserSession>(
    "/users/get-information-current-user",
  );
  return data;
};

const findAllSupervisors = async () => {
  const { data } = await api.get<SupervisorUser[]>("/users/supervisors");
  return data;
};

export const UsersService = {
  getInformationCurrentUser,
  findAllSupervisors,
};
