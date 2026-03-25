import { api } from "./http";
import { MainType, ProcessItem, Zone } from "../types/hallazgos";

const findMainTypes = async () => {
  const { data } = await api.get<MainType[]>("/main-types");
  return data;
};

const findZones = async () => {
  const { data } = await api.get<Zone[]>("/zones");
  return data;
};

const findProcesses = async () => {
  const { data } = await api.get<ProcessItem[]>("/processes");
  return data;
};

export const CatalogsService = {
  findMainTypes,
  findZones,
  findProcesses,
};
