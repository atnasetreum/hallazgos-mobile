export interface BasicOption {
  id: number;
  name: string;
}

export interface MainType extends BasicOption {
  secondaryTypes: BasicOption[];
}

export interface ManufacturingPlant extends BasicOption {}

export interface Zone extends BasicOption {
  manufacturingPlant: ManufacturingPlant;
}

export interface ProcessItem extends BasicOption {
  manufacturingPlant: ManufacturingPlant;
}

export interface UserSession {
  id: number;
  name: string;
  email: string;
  role: string;
  manufacturingPlants: ManufacturingPlant[];
}

export interface SupervisorUser {
  id: number;
  name: string;
  manufacturingPlants: ManufacturingPlant[];
  zones: BasicOption[];
}

export interface CommentEvidence {
  id: number;
  comment: string;
  user: { name: string };
  createdAt: string;
}

export interface Evidence {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  solutionDate: string | null;
  imgEvidence: string;
  imgSolution: string;
  description?: string;
  descriptionSolution?: string;
  manufacturingPlant: { name: string };
  user: { name: string };
  mainType: { name: string };
  secondaryType: { name: string };
  supervisors: { id: number; name: string }[];
  responsibles: { id: number; name: string }[];
  comments: CommentEvidence[];
  zone: { name: string };
  process: { name: string } | null;
}

export interface FiltersEvidences {
  manufacturingPlantId: string;
  mainTypeId: string;
  secondaryType: string;
  zone: string;
  process: string;
  state: string;
}
