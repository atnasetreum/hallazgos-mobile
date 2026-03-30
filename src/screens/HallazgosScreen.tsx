import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

import {
  ROLE_ADMINISTRADOR,
  ROLE_SUPERVISOR,
  STATUS_CLOSED,
  STATUS_OPEN,
  STATUS_OPTIONS,
} from "../constants/hallazgos";
import { CatalogsService } from "../services/catalogs.service";
import { EvidencesService } from "../services/evidences.service";
import { UsersService } from "../services/users.service";
import {
  Evidence,
  FiltersEvidences,
  MainType,
  ProcessItem,
  SupervisorUser,
  UserSession,
  Zone,
} from "../types/hallazgos";
import { durationToText, notify, stringToDateWithTime } from "../utils";

interface Props {
  onLogout: () => void;
}

const initialFilters: FiltersEvidences = {
  manufacturingPlantId: "",
  mainTypeId: "",
  secondaryType: "",
  zone: "",
  process: "",
  state: "",
};

const renderStatusColor = (status: string) => {
  if (status === STATUS_OPEN) {
    return "#ed6c02";
  }

  if (status === STATUS_CLOSED) {
    return "#2e7d32";
  }

  return "#d32f2f";
};

export const HallazgosScreen = ({ onLogout }: Props) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactScreen = width < 430;

  const [isLoadingBoot, setIsLoadingBoot] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingClose, setIsSavingClose] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [shouldScrollCreateToEnd, setShouldScrollCreateToEnd] = useState(false);
  const [shouldScrollCloseToEnd, setShouldScrollCloseToEnd] = useState(false);

  const createModalScrollRef = useRef<ScrollView | null>(null);
  const closeModalScrollRef = useRef<ScrollView | null>(null);

  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [mainTypes, setMainTypes] = useState<MainType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);

  const [filters, setFilters] = useState<FiltersEvidences>(initialFilters);
  const [rows, setRows] = useState<Evidence[]>([]);
  const [countEvidence, setCountEvidence] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(
    null,
  );
  const [newComment, setNewComment] = useState("");

  const [createVisible, setCreateVisible] = useState(false);
  const [createPlantId, setCreatePlantId] = useState("");
  const [createMainTypeId, setCreateMainTypeId] = useState("");
  const [createSecondaryTypeId, setCreateSecondaryTypeId] = useState("");
  const [createZoneId, setCreateZoneId] = useState("");
  const [createProcessId, setCreateProcessId] = useState("");
  const [createSupervisorId, setCreateSupervisorId] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createImageUri, setCreateImageUri] = useState("");

  const [closeVisible, setCloseVisible] = useState(false);
  const [evidenceToClose, setEvidenceToClose] = useState<Evidence | null>(null);
  const [closeImageUri, setCloseImageUri] = useState("");
  const [closeDescriptionSolution, setCloseDescriptionSolution] = useState("");

  const secondaryTypes = useMemo(() => {
    if (!filters.mainTypeId) {
      return [];
    }

    return (
      mainTypes.find((item) => item.id === Number(filters.mainTypeId))
        ?.secondaryTypes || []
    );
  }, [filters.mainTypeId, mainTypes]);

  const zonesFiltered = useMemo(() => {
    if (!filters.manufacturingPlantId) {
      return [];
    }

    return zones.filter(
      (item) =>
        Number(item.manufacturingPlant.id) ===
        Number(filters.manufacturingPlantId),
    );
  }, [zones, filters.manufacturingPlantId]);

  const createSecondaryTypes = useMemo(() => {
    if (!createMainTypeId) {
      return [];
    }

    return (
      mainTypes.find((item) => item.id === Number(createMainTypeId))
        ?.secondaryTypes || []
    );
  }, [createMainTypeId, mainTypes]);

  const createZonesFiltered = useMemo(() => {
    if (!createPlantId) {
      return [];
    }

    return zones.filter(
      (item) => Number(item.manufacturingPlant.id) === Number(createPlantId),
    );
  }, [zones, createPlantId]);

  const createProcessesFiltered = useMemo(() => {
    if (!createPlantId) {
      return [];
    }

    return processes.filter(
      (item) => Number(item.manufacturingPlant.id) === Number(createPlantId),
    );
  }, [processes, createPlantId]);

  const createSupervisorsFiltered = useMemo(() => {
    if (!createPlantId || !createZoneId) {
      return [];
    }

    return supervisors.filter((item) => {
      const hasPlant = item.manufacturingPlants.some(
        (plant) => Number(plant.id) === Number(createPlantId),
      );
      const hasZone = item.zones.some(
        (zone) => Number(zone.id) === Number(createZoneId),
      );

      return hasPlant && hasZone;
    });
  }, [supervisors, createPlantId, createZoneId]);

  const isUnsafeBehavior = useMemo(() => {
    if (!createMainTypeId) {
      return false;
    }

    const mainTypeCurrent = mainTypes.find(
      (item) => item.id === Number(createMainTypeId),
    );

    return !!mainTypeCurrent?.name
      .toLowerCase()
      .includes("comportamiento inseguro");
  }, [createMainTypeId, mainTypes]);

  const isUnsafeBehaviorClose = useMemo(() => {
    return !!evidenceToClose?.mainType?.name
      ?.toLowerCase()
      .includes("comportamiento inseguro");
  }, [evidenceToClose]);

  const fetchRows = useCallback(async () => {
    try {
      setIsLoadingRows(true);
      const data = await EvidencesService.findAll({
        filters,
        page,
        limit: rowsPerPage,
      });
      setRows(data.data);
      setCountEvidence(data.count);
    } finally {
      setIsLoadingRows(false);
    }
  }, [filters, page, rowsPerPage]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [
          user,
          catalogMainTypes,
          catalogZones,
          catalogProcesses,
          supervisorsList,
        ] = await Promise.all([
          UsersService.getInformationCurrentUser(),
          CatalogsService.findMainTypes(),
          CatalogsService.findZones(),
          CatalogsService.findProcesses(),
          UsersService.findAllSupervisors(),
        ]);

        setUserSession(user);
        setMainTypes(catalogMainTypes);
        setZones(catalogZones);
        setProcesses(catalogProcesses);
        setSupervisors(supervisorsList);

        if (user.manufacturingPlants.length === 1) {
          const singlePlant = String(user.manufacturingPlants[0].id);
          setFilters((prev) => ({
            ...prev,
            manufacturingPlantId: singlePlant,
          }));
          setCreatePlantId(singlePlant);
        }
      } finally {
        setIsLoadingBoot(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!isLoadingBoot) {
      fetchRows();
    }
  }, [fetchRows, isLoadingBoot]);

  const canGoNext = page * rowsPerPage < countEvidence;

  const rowStats = useMemo(() => {
    const open = rows.filter((item) => item.status === STATUS_OPEN).length;
    const closed = rows.filter((item) => item.status === STATUS_CLOSED).length;

    return {
      open,
      closed,
      other: Math.max(0, rows.length - open - closed),
    };
  }, [rows]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter((value) => !!value).length;
  }, [filters]);

  const activeFilterNames = useMemo(() => {
    const labels: Record<keyof FiltersEvidences, string> = {
      manufacturingPlantId: "Planta",
      mainTypeId: "Hallazgo",
      secondaryType: "Tipo",
      zone: "Zona",
      process: "Administrador",
      state: "Estatus",
    };

    return (Object.keys(filters) as Array<keyof FiltersEvidences>)
      .filter((key) => !!filters[key])
      .map((key) => labels[key]);
  }, [filters]);

  const handleChangeFilter = (key: keyof FiltersEvidences, value: string) => {
    setPage(1);

    if (key === "mainTypeId") {
      setFilters((prev) => ({
        ...prev,
        mainTypeId: value,
        secondaryType: "",
      }));
      return;
    }

    if (key === "manufacturingPlantId") {
      setFilters((prev) => ({
        ...prev,
        manufacturingPlantId: value,
        zone: "",
      }));
      return;
    }

    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    const defaultPlantId =
      userSession?.manufacturingPlants.length === 1
        ? String(userSession.manufacturingPlants[0].id)
        : "";

    setPage(1);
    setFilters({
      ...initialFilters,
      manufacturingPlantId: defaultPlantId,
    });
  };

  const handleCancelEvidence = async (evidence: Evidence) => {
    if (evidence.status !== STATUS_OPEN) {
      return;
    }

    await EvidencesService.remove(evidence.id);
    notify("Hallazgo cancelado correctamente", true);
    await fetchRows();
  };

  const handleAddComment = async () => {
    if (!selectedEvidence) {
      return;
    }

    const comment = newComment.trim();

    if (!comment) {
      notify("El comentario es requerido");
      return;
    }

    try {
      setIsSavingComment(true);
      await EvidencesService.addComment(selectedEvidence.id, comment);
      setNewComment("");
      notify("Comentario agregado correctamente", true);
      await fetchRows();
    } finally {
      setIsSavingComment(false);
    }
  };

  const openCreate = () => {
    setCreateVisible(true);
  };

  const closeCreate = () => {
    setCreateVisible(false);
    setCreateMainTypeId("");
    setCreateSecondaryTypeId("");
    setCreateZoneId("");
    setCreateProcessId("");
    setCreateSupervisorId("");
    setCreateDescription("");
    setCreateImageUri("");

    if (userSession?.manufacturingPlants.length !== 1) {
      setCreatePlantId("");
    }
  };

  const openCloseEvidence = (row: Evidence) => {
    setEvidenceToClose(row);
    setCloseVisible(true);
  };

  const closeCloseEvidence = () => {
    setCloseVisible(false);
    setEvidenceToClose(null);
    setCloseImageUri("");
    setCloseDescriptionSolution("");
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      notify("Se requiere permiso para usar imágenes");
      return;
    }

    const response = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.7,
        });

    if (!response.canceled && response.assets.length) {
      setCreateImageUri(response.assets[0].uri);
      setShouldScrollCreateToEnd(true);
    }
  };

  const pickCloseImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      notify("Se requiere permiso para usar imágenes");
      return;
    }

    const response = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.7,
        });

    if (!response.canceled && response.assets.length) {
      setCloseImageUri(response.assets[0].uri);
      setShouldScrollCloseToEnd(true);
    }
  };

  const saveEvidence = async () => {
    const descriptionClean = createDescription.trim();

    if (!createPlantId || !createMainTypeId || !createSecondaryTypeId) {
      notify("Complete planta, hallazgo y tipo");
      return;
    }

    if (!createZoneId || !createProcessId) {
      notify("Complete zona y proceso");
      return;
    }

    if (!descriptionClean) {
      notify("La descripción es requerida");
      return;
    }

    if (!isUnsafeBehavior && !createImageUri) {
      notify("La imagen del hallazgo es requerida");
      return;
    }

    try {
      setIsSavingCreate(true);

      await EvidencesService.create(
        {
          manufacturingPlantId: createPlantId,
          typeHallazgo: createMainTypeId,
          type: createSecondaryTypeId,
          zone: createZoneId,
          process: createProcessId,
          description: descriptionClean,
          ...(createSupervisorId ? { supervisor: createSupervisorId } : {}),
        },
        createImageUri || undefined,
      );

      notify("Hallazgo creado correctamente", true);
      closeCreate();
      await fetchRows();
    } finally {
      setIsSavingCreate(false);
    }
  };

  const saveCloseEvidence = async () => {
    if (!evidenceToClose) {
      return;
    }

    const descriptionClean = closeDescriptionSolution.trim();

    if (isUnsafeBehaviorClose && !descriptionClean) {
      notify("La descripción de la solución es requerida");
      return;
    }

    if (!isUnsafeBehaviorClose && !closeImageUri) {
      notify("La imagen de solución es requerida");
      return;
    }

    try {
      setIsSavingClose(true);

      await EvidencesService.solution(
        evidenceToClose.id,
        { descriptionSolution: descriptionClean },
        closeImageUri || undefined,
      );

      notify("Hallazgo cerrado correctamente", true);
      closeCloseEvidence();
      await fetchRows();
    } finally {
      setIsSavingClose(false);
    }
  };

  if (isLoadingBoot) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#71BF44" />
        <Text>Cargando hallazgos...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(12, insets.bottom + 8) },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text variant="headlineSmall" style={styles.title}>
            Hallazgos
          </Text>
          <Text variant="bodySmall" style={styles.headerSubtitle}>
            {userSession?.name} ({userSession?.role})
          </Text>
        </View>
        <IconButton icon="logout" onPress={onLogout} />
      </View>

      <View style={styles.headerActionsRow}>
        <Button
          mode="contained"
          icon="plus"
          onPress={openCreate}
          buttonColor="#71BF44"
          textColor="#ffffff"
        >
          Crear
        </Button>
        <Button
          mode="outlined"
          icon="refresh"
          onPress={fetchRows}
          textColor="#4b8f2e"
        >
          Actualizar
        </Button>
      </View>

      <View style={styles.kpiRow}>
        <Chip style={styles.kpiChip} textStyle={styles.kpiText}>
          Total: {countEvidence}
        </Chip>
        {/* <Chip
          style={[styles.kpiChip, styles.kpiOpen]}
          textStyle={styles.kpiText}
        >
          Abiertos: {rowStats.open}
        </Chip>
        <Chip
          style={[styles.kpiChip, styles.kpiClosed]}
          textStyle={styles.kpiText}
        >
          Cerrados: {rowStats.closed}
        </Chip> 
        {rowStats.other > 0 && (
          <Chip
            style={[styles.kpiChip, styles.kpiOther]}
            textStyle={styles.kpiText}
          >
            Otros: {rowStats.other}
          </Chip>
        )}*/}
      </View>

      <Surface style={styles.filtersContainer} elevation={1}>
        <View style={styles.filtersHeader}>
          <View style={styles.filtersHeaderTitleWrap}>
            <Text variant="titleSmall" style={styles.filtersTitle}>
              Filtros ({countEvidence})
            </Text>
            <Text variant="labelSmall" style={styles.filtersSummary}>
              {activeFiltersCount > 0
                ? `${activeFiltersCount} activos`
                : "Sin filtros activos"}
            </Text>
          </View>

          <View style={styles.filtersHeaderActions}>
            {activeFiltersCount > 0 && (
              <Button
                compact
                mode="text"
                textColor="#4b8f2e"
                onPress={clearFilters}
              >
                Limpiar
              </Button>
            )}
            <IconButton
              icon={filtersExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              onPress={() => setFiltersExpanded((prev) => !prev)}
            />
          </View>
        </View>

        {activeFilterNames.length > 0 && (
          <View style={styles.activeFiltersRow}>
            {activeFilterNames.map((name) => (
              <Chip key={name} compact style={styles.activeFilterChip}>
                {name}
              </Chip>
            ))}
          </View>
        )}

        {filtersExpanded && (
          <View style={styles.filtersGrid}>
            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Planta</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.manufacturingPlantId}
                  onValueChange={(value) =>
                    handleChangeFilter("manufacturingPlantId", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  <Picker.Item label="Todas" value="" />
                  {userSession?.manufacturingPlants.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={item.name}
                      value={String(item.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Hallazgo</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.mainTypeId}
                  onValueChange={(value) =>
                    handleChangeFilter("mainTypeId", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  <Picker.Item label="Todos" value="" />
                  {mainTypes.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={item.name}
                      value={String(item.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Tipo</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.secondaryType}
                  onValueChange={(value) =>
                    handleChangeFilter("secondaryType", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  <Picker.Item label="Todos" value="" />
                  {secondaryTypes.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={item.name}
                      value={String(item.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Zona</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.zone}
                  onValueChange={(value) =>
                    handleChangeFilter("zone", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  <Picker.Item label="Todas" value="" />
                  {zonesFiltered.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={item.name}
                      value={String(item.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Administrador</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.process}
                  onValueChange={(value) =>
                    handleChangeFilter("process", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  <Picker.Item label="Todos" value="" />
                  {processes.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={item.name}
                      value={String(item.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={[
                styles.filterItem,
                isCompactScreen && styles.filterItemFull,
              ]}
            >
              <Text style={styles.compactFilterLabel}>Estatus</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  mode="dropdown"
                  dropdownIconColor="#4b5563"
                  selectedValue={filters.state}
                  onValueChange={(value) =>
                    handleChangeFilter("state", String(value))
                  }
                  style={styles.compactPicker}
                  itemStyle={styles.pickerItemText}
                >
                  {STATUS_OPTIONS.map((item) => (
                    <Picker.Item
                      key={item.name}
                      label={item.name}
                      value={item.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        )}
      </Surface>

      {isLoadingRows ? (
        <ActivityIndicator
          size="small"
          color="#71BF44"
          style={styles.loadingRows}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(30, insets.bottom + 24) },
          ]}
          renderItem={({ item }) => {
            const isAdmin = userSession?.role === ROLE_ADMINISTRADOR;
            const canCancel = isAdmin && item.status === STATUS_OPEN;
            const canClose =
              item.status === STATUS_OPEN &&
              [ROLE_SUPERVISOR, ROLE_ADMINISTRADOR].includes(
                userSession?.role || "",
              );

            return (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">#{item.id}</Text>
                    <Chip
                      textStyle={styles.chipText}
                      style={{
                        backgroundColor: renderStatusColor(item.status),
                      }}
                    >
                      {item.status}
                    </Chip>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Planta</Text>
                      <Text style={styles.metaValue}>
                        {item.manufacturingPlant.name}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Grupo</Text>
                      <Text style={styles.metaValue}>{item.mainType.name}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Tipo</Text>
                      <Text style={styles.metaValue}>
                        {item.secondaryType.name}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Zona</Text>
                      <Text style={styles.metaValue}>{item.zone.name}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Proceso</Text>
                      <Text style={styles.metaValue}>
                        {item.process?.name || "-"}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Creación</Text>
                      <Text style={styles.metaValue}>
                        {stringToDateWithTime(item.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Actualización</Text>
                      <Text style={styles.metaValue}>
                        {stringToDateWithTime(item.updatedAt)}
                      </Text>
                    </View>
                    {!!item.solutionDate && (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Cierre</Text>
                        <Text style={styles.metaValue}>
                          {stringToDateWithTime(item.solutionDate)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <Button
                      mode="contained"
                      buttonColor="#9c27b0"
                      textColor="#ffffff"
                      onPress={() => setSelectedEvidence(item)}
                    >
                      Detalles
                    </Button>
                    {canClose && (
                      <Button
                        mode="contained"
                        buttonColor="#ed6c02"
                        textColor="#ffffff"
                        onPress={() => openCloseEvidence(item)}
                      >
                        Cerrar hallazgo
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        mode="contained"
                        buttonColor="#d32f2f"
                        onPress={() => handleCancelEvidence(item)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Sin hallazgos para los filtros seleccionados.
            </Text>
          }
          ListFooterComponent={
            <View style={styles.pagination}>
              <Button
                disabled={page <= 1}
                textColor="#4b8f2e"
                onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <Text>Página {page}</Text>
              <Button
                disabled={!canGoNext}
                textColor="#4b8f2e"
                onPress={() => setPage((prev) => prev + 1)}
              >
                Siguiente
              </Button>
            </View>
          }
        />
      )}

      <Modal
        visible={createVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCreate}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(10, insets.bottom + 6) },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text variant="titleMedium">Crear hallazgo</Text>
              <IconButton icon="close" onPress={closeCreate} />
            </View>
            <Divider />

            <ScrollView
              ref={createModalScrollRef}
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              onContentSizeChange={() => {
                if (shouldScrollCreateToEnd) {
                  createModalScrollRef.current?.scrollToEnd({ animated: true });
                  setShouldScrollCreateToEnd(false);
                }
              }}
            >
              <Text style={styles.label}>Planta</Text>
              <Picker
                selectedValue={createPlantId}
                onValueChange={(value) => {
                  setCreatePlantId(String(value));
                  setCreateZoneId("");
                  setCreateProcessId("");
                  setCreateSupervisorId("");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione" value="" />
                {userSession?.manufacturingPlants.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Hallazgo</Text>
              <Picker
                selectedValue={createMainTypeId}
                onValueChange={(value) => {
                  setCreateMainTypeId(String(value));
                  setCreateSecondaryTypeId("");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione" value="" />
                {mainTypes.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Tipo</Text>
              <Picker
                selectedValue={createSecondaryTypeId}
                onValueChange={(value) =>
                  setCreateSecondaryTypeId(String(value))
                }
                style={styles.picker}
              >
                <Picker.Item label="Seleccione" value="" />
                {createSecondaryTypes.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Zona</Text>
              <Picker
                selectedValue={createZoneId}
                onValueChange={(value) => {
                  setCreateZoneId(String(value));
                  setCreateSupervisorId("");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione" value="" />
                {createZonesFiltered.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Proceso</Text>
              <Picker
                selectedValue={createProcessId}
                onValueChange={(value) => setCreateProcessId(String(value))}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione" value="" />
                {createProcessesFiltered.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Supervisor (opcional)</Text>
              <Picker
                selectedValue={createSupervisorId}
                onValueChange={(value) => setCreateSupervisorId(String(value))}
                style={styles.picker}
              >
                <Picker.Item label="Asignar automáticamente" value="" />
                {createSupervisorsFiltered.map((item) => (
                  <Picker.Item
                    key={item.id}
                    label={item.name}
                    value={String(item.id)}
                  />
                ))}
              </Picker>

              <TextInput
                mode="outlined"
                label="Descripción"
                value={createDescription}
                onChangeText={setCreateDescription}
                multiline
              />

              <View style={styles.actionsRow}>
                <Button mode="outlined" onPress={() => pickImage(false)}>
                  Galería
                </Button>
                <Button mode="outlined" onPress={() => pickImage(true)}>
                  Cámara
                </Button>
                {!!createImageUri && (
                  <Button mode="text" onPress={() => setCreateImageUri("")}>
                    Quitar
                  </Button>
                )}
              </View>

              {!!createImageUri && (
                <Image
                  source={{ uri: createImageUri }}
                  style={styles.photoPreview}
                />
              )}

              {!isUnsafeBehavior && !createImageUri && (
                <Text variant="labelSmall" style={styles.photoHint}>
                  Para este tipo de hallazgo la imagen es requerida.
                </Text>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={saveEvidence}
                  loading={isSavingCreate}
                  disabled={isSavingCreate}
                >
                  Guardar hallazgo
                </Button>
                <Pressable onPress={closeCreate}>
                  <Text style={styles.closeText}>Cancelar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={closeVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCloseEvidence}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(10, insets.bottom + 6) },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text variant="titleMedium">Cerrar hallazgo</Text>
              <IconButton icon="close" onPress={closeCloseEvidence} />
            </View>
            <Divider />

            <ScrollView
              ref={closeModalScrollRef}
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              onContentSizeChange={() => {
                if (shouldScrollCloseToEnd) {
                  closeModalScrollRef.current?.scrollToEnd({ animated: true });
                  setShouldScrollCloseToEnd(false);
                }
              }}
            >
              {!!evidenceToClose?.description && isUnsafeBehaviorClose && (
                <>
                  <Text style={styles.label}>Descripción actual</Text>
                  <Text>{evidenceToClose.description}</Text>
                </>
              )}

              <TextInput
                mode="outlined"
                label="Descripción de la solución"
                value={closeDescriptionSolution}
                onChangeText={setCloseDescriptionSolution}
                multiline
              />

              <View style={styles.actionsRow}>
                <Button mode="outlined" onPress={() => pickCloseImage(false)}>
                  Galería
                </Button>
                <Button mode="outlined" onPress={() => pickCloseImage(true)}>
                  Cámara
                </Button>
                {!!closeImageUri && (
                  <Button mode="text" onPress={() => setCloseImageUri("")}>
                    Quitar
                  </Button>
                )}
              </View>

              {!!closeImageUri && (
                <Image
                  source={{ uri: closeImageUri }}
                  style={styles.photoPreview}
                />
              )}

              {!isUnsafeBehaviorClose && !closeImageUri && (
                <Text variant="labelSmall" style={styles.photoHint}>
                  Para este tipo de hallazgo la imagen de solución es requerida.
                </Text>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={saveCloseEvidence}
                  loading={isSavingClose}
                  disabled={isSavingClose}
                >
                  Guardar cierre
                </Button>
                <Pressable onPress={closeCloseEvidence}>
                  <Text style={styles.closeText}>Cancelar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedEvidence}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvidence(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(10, insets.bottom + 6) },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text variant="titleMedium">Detalles del hallazgo</Text>
              <IconButton
                icon="close"
                onPress={() => setSelectedEvidence(null)}
              />
            </View>
            <Divider />
            {selectedEvidence && (
              <FlatList
                data={selectedEvidence.comments}
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={
                  <View style={styles.detailsBlock}>
                    <Text>
                      Planta: {selectedEvidence.manufacturingPlant.name}
                    </Text>
                    <Text>Grupo: {selectedEvidence.mainType.name}</Text>
                    <Text>Tipo: {selectedEvidence.secondaryType.name}</Text>
                    <Text>Zona: {selectedEvidence.zone.name}</Text>
                    <Text>Creado por: {selectedEvidence.user.name}</Text>
                    <Text>
                      Tiempo abierto:{" "}
                      {selectedEvidence.solutionDate
                        ? durationToText(
                            selectedEvidence.createdAt,
                            selectedEvidence.solutionDate,
                          )
                        : "En proceso"}
                    </Text>
                    <Text style={styles.sectionTitle}>Descripción</Text>
                    <Text>
                      {selectedEvidence.description || "Sin descripción"}
                    </Text>
                    {!!selectedEvidence.descriptionSolution && (
                      <>
                        <Text style={styles.sectionTitle}>Solución</Text>
                        <Text>{selectedEvidence.descriptionSolution}</Text>
                      </>
                    )}

                    <View style={styles.imagesRow}>
                      {!!selectedEvidence.imgEvidence && (
                        <Image
                          source={{
                            uri: EvidencesService.imageUrl(
                              selectedEvidence.imgEvidence,
                            ),
                          }}
                          style={styles.photo}
                        />
                      )}
                      {!!selectedEvidence.imgSolution && (
                        <Image
                          source={{
                            uri: EvidencesService.imageUrl(
                              selectedEvidence.imgSolution,
                            ),
                          }}
                          style={styles.photo}
                        />
                      )}
                    </View>
                    <Text style={styles.sectionTitle}>Comentarios</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Text style={styles.commentAuthor}>{item.user.name}</Text>
                    <Text>{item.comment}</Text>
                    <Text variant="labelSmall">
                      {stringToDateWithTime(item.createdAt)}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={<Text>Sin comentarios.</Text>}
              />
            )}

            <TextInput
              mode="outlined"
              label="Agregar comentario"
              value={newComment}
              onChangeText={setNewComment}
            />
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleAddComment}
                loading={isSavingComment}
                disabled={isSavingComment}
              >
                Guardar comentario
              </Button>
              <Pressable onPress={() => setSelectedEvidence(null)}>
                <Text style={styles.closeText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 12,
    paddingTop: 6,
    backgroundColor: "#f3f4f6",
    gap: 10,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e7ebf0",
  },
  title: {
    fontWeight: "700",
    color: "#2f6d21",
  },
  headerSubtitle: {
    color: "#5f6368",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiChip: {
    backgroundColor: "#eef5ea",
    borderWidth: 1,
    borderColor: "#dbe4d5",
  },
  kpiOpen: {
    backgroundColor: "#fff3e5",
    borderColor: "#ffd3a4",
  },
  kpiClosed: {
    backgroundColor: "#e9f6ec",
    borderColor: "#cbe8d2",
  },
  kpiOther: {
    backgroundColor: "#f5eefe",
    borderColor: "#deccf7",
  },
  kpiText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2f3a2e",
  },
  filtersContainer: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dbe4d5",
    backgroundColor: "#f7faf5",
  },
  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersHeaderTitleWrap: {
    flexShrink: 1,
  },
  filtersHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  filtersTitle: {
    color: "#4b8f2e",
    fontWeight: "700",
  },
  filtersSummary: {
    color: "#6b7280",
  },
  activeFiltersRow: {
    marginTop: 6,
    marginBottom: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  activeFilterChip: {
    backgroundColor: "#e9f6ec",
    borderWidth: 1,
    borderColor: "#cbe8d2",
  },
  filtersGrid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterItem: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6ece2",
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 4,
  },
  filterItemFull: {
    width: "100%",
  },
  compactFilterLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 0,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  pickerWrapper: {
    borderWidth: Platform.OS === "android" ? 0 : 1,
    borderColor: "#dbe4d5",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  compactPicker: {
    height: Platform.OS === "android" ? 50 : 120,
    color: "#1f2937",
  },
  pickerItemText: {
    fontSize: 14,
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    color: "#5f6368",
  },
  picker: {
    marginTop: -6,
  },
  loadingRows: {
    marginVertical: 16,
  },
  listContent: {
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7ebf0",
    backgroundColor: "#ffffff",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 8,
  },
  metaItem: {
    width: "48%",
  },
  metaLabel: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 13,
    color: "#1f2937",
    fontWeight: "600",
  },
  cardActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  empty: {
    textAlign: "center",
    marginTop: 20,
  },
  pagination: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 12,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: "90%",
    padding: 10,
    gap: 8,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 6,
    gap: 4,
  },
  detailsBlock: {
    gap: 4,
    paddingVertical: 8,
  },
  sectionTitle: {
    marginTop: 8,
    fontWeight: "700",
  },
  imagesRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  photo: {
    width: 130,
    height: 130,
    borderRadius: 8,
    backgroundColor: "#eef1f5",
  },
  commentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eceff3",
    gap: 2,
  },
  commentAuthor: {
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 4,
    gap: 8,
    alignItems: "center",
  },
  closeText: {
    color: "#4b8f2e",
    fontWeight: "600",
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#eef1f5",
  },
  photoHint: {
    color: "#d32f2f",
  },
});
