import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

import { appConfig } from "../constants/app";
import { Evidence, FiltersEvidences } from "../types/hallazgos";
import { api } from "./http";

const GRAPHQL_QUERY = `
  query Evidences(
    $page: Int!
    $limit: Int!
    $manufacturingPlantId: Float
    $mainTypeId: Float
    $secondaryTypeId: Float
    $zoneId: Float
    $processId: Float
    $status: String
  ) {
    evidences(
      page: $page
      limit: $limit
      manufacturingPlantId: $manufacturingPlantId
      mainTypeId: $mainTypeId
      secondaryTypeId: $secondaryTypeId
      zoneId: $zoneId
      processId: $processId
      status: $status
    ) {
      count
      data {
        id
        status
        createdAt
        updatedAt
        solutionDate
        imgEvidence
        imgSolution
        description
        descriptionSolution
        manufacturingPlant { name }
        user { name }
        mainType { name }
        secondaryType { name }
        supervisors { id name }
        responsibles { id name }
        zone { name }
        process { name }
        comments {
          id
          comment
          user { name }
          createdAt
        }
      }
    }
  }
`;

interface EvidenceGraphqlResponse {
  data: {
    evidences: {
      count: number;
      data: Evidence[];
    };
  };
}

interface CreateEvidencePayload {
  manufacturingPlantId: string;
  typeHallazgo: string;
  type: string;
  zone: string;
  process: string;
  description: string;
  supervisor?: string;
}

interface SolutionPayload {
  descriptionSolution?: string;
}

const getApiOrigin = () => appConfig.apiUrl.replace(/\/api\/v1\/?$/, "");

const getGraphQlUrl = () =>
  process.env.EXPO_PUBLIC_API_URL_GRAPHQL || `${getApiOrigin()}/graphql`;

const mapFilterVariables = (filters: FiltersEvidences) => ({
  ...(filters.manufacturingPlantId && {
    manufacturingPlantId: Number(filters.manufacturingPlantId),
  }),
  ...(filters.mainTypeId && { mainTypeId: Number(filters.mainTypeId) }),
  ...(filters.secondaryType && {
    secondaryTypeId: Number(filters.secondaryType),
  }),
  ...(filters.zone && { zoneId: Number(filters.zone) }),
  ...(filters.process && { processId: Number(filters.process) }),
  ...(filters.state && { status: filters.state }),
});

const findAll = async ({
  filters,
  page,
  limit,
}: {
  filters: FiltersEvidences;
  page: number;
  limit: number;
}) => {
  const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);

  const { data } = await axios.post<EvidenceGraphqlResponse>(
    getGraphQlUrl(),
    {
      query: GRAPHQL_QUERY,
      variables: {
        page,
        limit,
        ...mapFilterVariables(filters),
      },
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-app-key": appConfig.appKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  return data.data.evidences;
};

const create = async (payload: CreateEvidencePayload, imageUri?: string) => {
  const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);
  const formData = new FormData();

  formData.append("manufacturingPlantId", payload.manufacturingPlantId);
  formData.append("typeHallazgo", payload.typeHallazgo);
  formData.append("type", payload.type);
  formData.append("zone", payload.zone);
  formData.append("process", payload.process);
  formData.append("description", payload.description);

  if (payload.supervisor) {
    formData.append("supervisor", payload.supervisor);
  }

  if (imageUri) {
    const fileName = `${Date.now()}-evidence.jpg`;
    formData.append("file", {
      uri: imageUri,
      name: fileName,
      type: "image/jpeg",
    } as unknown as Blob);
  }

  const { data } = await axios.post(`${appConfig.apiUrl}/evidences`, formData, {
    headers: {
      Accept: "application/json",
      "Content-Type": "multipart/form-data",
      "x-app-key": appConfig.appKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return data;
};

const solution = async (
  id: number,
  payload: SolutionPayload,
  imageUri?: string,
) => {
  const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);
  const formData = new FormData();

  formData.append("descriptionSolution", payload.descriptionSolution || "");

  if (imageUri) {
    const fileName = `${Date.now()}-solution.jpg`;
    formData.append("file", {
      uri: imageUri,
      name: fileName,
      type: "image/jpeg",
    } as unknown as Blob);
  }

  const { data } = await axios.post(
    `${appConfig.apiUrl}/evidences/solution/${id}`,
    formData,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "multipart/form-data",
        "x-app-key": appConfig.appKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  return data;
};

const addComment = async (id: number, comment: string) => {
  const { data } = await api.post(`/evidences/add/comment/${id}`, { comment });
  return data;
};

const remove = async (id: number) => {
  const { data } = await api.delete(`/evidences/${id}`);
  return data;
};

const openDownload = async (
  type: "xlsx" | "pdf",
  filters: FiltersEvidences,
) => {
  const params = new URLSearchParams();

  if (filters.manufacturingPlantId) {
    params.append("manufacturingPlantId", filters.manufacturingPlantId);
  }
  if (filters.mainTypeId) {
    params.append("mainTypeId", filters.mainTypeId);
  }
  if (filters.secondaryType) {
    params.append("secondaryType", filters.secondaryType);
  }
  if (filters.zone) {
    params.append("zone", filters.zone);
  }
  if (filters.state) {
    params.append("status", filters.state);
  }

  const token = await AsyncStorage.getItem(appConfig.tokenStorageKey);

  const url = `${appConfig.apiUrl}/evidences/download/${type}?${params.toString()}`;

  if (token) {
    await Linking.openURL(
      `${url}${params.toString() ? "&" : ""}token=${encodeURIComponent(token)}`,
    );
    return;
  }

  await Linking.openURL(url);
};

const imageUrl = (imageName?: string) => {
  if (!imageName) {
    return "";
  }
  return `${getApiOrigin()}/static/images/evidences/${imageName}`;
};

export const EvidencesService = {
  findAll,
  create,
  solution,
  addComment,
  remove,
  openDownload,
  imageUrl,
};
