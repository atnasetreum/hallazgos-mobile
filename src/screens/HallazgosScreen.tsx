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
  const [createValidationMessage, setCreateValidationMessage] = useState("");

  const [closeVisible, setCloseVisible] = useState(false);
  const [evidenceToClose, setEvidenceToClose] = useState<Evidence | null>(null);
  const [closeImageUri, setCloseImageUri] = useState("");
  const [closeDescriptionSolution, setCloseDescriptionSolution] = useState("");
  const [closeValidationMessage, setCloseValidationMessage] = useState("");
  const [commentValidationMessage, setCommentValidationMessage] = useState("");
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState("");
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("");
  const [confirmDialogAction, setConfirmDialogAction] = useState<
    (() => void | Promise<void>) | null
  >(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState("");
  const [imagePreviewLabel, setImagePreviewLabel] = useState("");

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

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
  ) => {
    setConfirmDialogTitle(title);
    setConfirmDialogMessage(message);
    setConfirmDialogAction(() => onConfirm);
    setConfirmDialogVisible(true);
  };

  const closeConfirmDialog = () => {
    setConfirmDialogVisible(false);
    setConfirmDialogTitle("");
    setConfirmDialogMessage("");
    setConfirmDialogAction(null);
  };

  const handleConfirmDialog = () => {
    const action = confirmDialogAction;
    closeConfirmDialog();

    if (action) {
      void action();
    }
  };

  const openImagePreview = (uri: string, label: string) => {
    setImagePreviewUri(uri);
    setImagePreviewLabel(label);
    setImagePreviewVisible(true);
  };

  const closeImagePreview = () => {
    setImagePreviewVisible(false);
    setImagePreviewUri("");
    setImagePreviewLabel("");
  };

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
      setCommentValidationMessage("El comentario es requerido");
      return;
    }

    try {
      setIsSavingComment(true);
      setCommentValidationMessage("");
      await EvidencesService.addComment(selectedEvidence.id, comment);
      setNewComment("");
      notify("Comentario agregado correctamente", true);
      await fetchRows();
    } finally {
      setIsSavingComment(false);
    }
  };

  const openCreate = () => {
    setCreateValidationMessage("");
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
    setCreateValidationMessage("");

    if (userSession?.manufacturingPlants.length !== 1) {
      setCreatePlantId("");
    }
  };

  const openCloseEvidence = (row: Evidence) => {
    setCloseValidationMessage("");
    setEvidenceToClose(row);
    setCloseVisible(true);
  };

  const closeCloseEvidence = () => {
    setCloseVisible(false);
    setEvidenceToClose(null);
    setCloseImageUri("");
    setCloseDescriptionSolution("");
    setCloseValidationMessage("");
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setCreateValidationMessage("Se requiere permiso para usar imágenes");
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
      setCreateValidationMessage("");
    }
  };

  const pickCloseImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setCloseValidationMessage("Se requiere permiso para usar imágenes");
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
      setCloseValidationMessage("");
    }
  };

  const saveEvidence = async () => {
    const descriptionClean = createDescription.trim();

    if (!createPlantId || !createMainTypeId || !createSecondaryTypeId) {
      setCreateValidationMessage("Complete planta, hallazgo y tipo");
      return;
    }

    if (!createZoneId || !createProcessId) {
      setCreateValidationMessage("Complete zona y proceso");
      return;
    }

    if (!descriptionClean) {
      setCreateValidationMessage("La descripción es requerida");
      return;
    }

    if (!isUnsafeBehavior && !createImageUri) {
      setCreateValidationMessage("La imagen del hallazgo es requerida");
      return;
    }

    try {
      setIsSavingCreate(true);
      setCreateValidationMessage("");

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
      setCloseValidationMessage("La descripción de la solución es requerida");
      return;
    }

    if (!isUnsafeBehaviorClose && !closeImageUri) {
      setCloseValidationMessage("La imagen de solución es requerida");
      return;
    }

    try {
      setIsSavingClose(true);
      setCloseValidationMessage("");

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
        <View style={styles.headerAccent} />
        <View style={styles.headerTextWrap}>
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
          mode="contained"
          icon="refresh"
          onPress={fetchRows}
          buttonColor="#71BF44"
          textColor="#ffffff"
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
                <Card.Content style={styles.cardContent}>
                  <View style={styles.cardTopAccent} />
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium" style={styles.cardIdText}>
                      #{item.id}
                    </Text>
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
                    <View style={styles.metaItemWide}>
                      <Text style={styles.metaLabel}>Tipo</Text>
                      <Text style={styles.metaValueStrong}>
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

                  {!!item.description && (
                    <View style={styles.descriptionBlock}>
                      <Text style={styles.metaLabel}>Descripción</Text>
                      <Text style={styles.descriptionValue} numberOfLines={3}>
                        {item.description}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardActions}>
                    <Button
                      mode="contained"
                      buttonColor="#71BF44"
                      textColor="#ffffff"
                      style={styles.cardActionButton}
                      onPress={() => setSelectedEvidence(item)}
                    >
                      Detalles
                    </Button>
                    {canClose && (
                      <Button
                        mode="contained"
                        buttonColor="#ed6c02"
                        textColor="#ffffff"
                        style={styles.cardActionButton}
                        onPress={() => openCloseEvidence(item)}
                      >
                        Cerrar hallazgo
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        mode="contained"
                        buttonColor="#d32f2f"
                        style={styles.cardActionButtonFull}
                        onPress={() =>
                          confirmAction(
                            "Cancelar hallazgo",
                            "Esta accion cancelara el hallazgo. Deseas continuar?",
                            () => handleCancelEvidence(item),
                          )
                        }
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
                mode="contained"
                disabled={page <= 1}
                buttonColor="#71BF44"
                textColor="#ffffff"
                onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <Text>Página {page}</Text>
              <Button
                mode="contained"
                disabled={!canGoNext}
                buttonColor="#71BF44"
                textColor="#ffffff"
                onPress={() => setPage((prev) => prev + 1)}
              >
                Siguiente
              </Button>
            </View>
          }
        />
      )}

      <Modal
        visible={confirmDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirmDialog}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text variant="titleMedium" style={styles.confirmTitle}>
              {confirmDialogTitle}
            </Text>
            <Text style={styles.confirmMessage}>{confirmDialogMessage}</Text>

            <View style={styles.confirmActions}>
              <Button
                mode="text"
                textColor="#6b7280"
                onPress={closeConfirmDialog}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                buttonColor="#71BF44"
                textColor="#ffffff"
                style={styles.confirmPrimaryButton}
                onPress={handleConfirmDialog}
              >
                Si, continuar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                mode="dropdown"
                dropdownIconColor="#4b5563"
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
                onChangeText={(value) => {
                  setCreateDescription(value);
                  if (createValidationMessage) {
                    setCreateValidationMessage("");
                  }
                }}
                multiline
              />

              <View style={styles.mediaActionsRow}>
                <Button
                  mode="contained"
                  buttonColor="#1d4ed8"
                  textColor="#ffffff"
                  style={styles.mediaActionButton}
                  onPress={() => pickImage(false)}
                >
                  Galería
                </Button>
                <Button
                  mode="contained"
                  buttonColor="#1d4ed8"
                  textColor="#ffffff"
                  style={styles.mediaActionButton}
                  onPress={() => pickImage(true)}
                >
                  Cámara
                </Button>
              </View>

              {!!createImageUri && (
                <Button mode="text" onPress={() => setCreateImageUri("")}>
                  Quitar
                </Button>
              )}

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

              {!!createValidationMessage && (
                <Text variant="labelSmall" style={styles.validationErrorText}>
                  {createValidationMessage}
                </Text>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  buttonColor="#d32f2f"
                  textColor="#ffffff"
                  onPress={() =>
                    confirmAction(
                      "Descartar cambios",
                      "Se perderan los datos capturados. Deseas cancelar?",
                      closeCreate,
                    )
                  }
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={saveEvidence}
                  loading={isSavingCreate}
                  disabled={isSavingCreate}
                >
                  Guardar hallazgo
                </Button>
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
                onChangeText={(value) => {
                  setCloseDescriptionSolution(value);
                  if (closeValidationMessage) {
                    setCloseValidationMessage("");
                  }
                }}
                multiline
              />

              <View style={styles.mediaActionsRow}>
                <Button
                  mode="contained"
                  buttonColor="#1d4ed8"
                  textColor="#ffffff"
                  style={styles.mediaActionButton}
                  onPress={() => pickCloseImage(false)}
                >
                  Galería
                </Button>
                <Button
                  mode="contained"
                  buttonColor="#1d4ed8"
                  textColor="#ffffff"
                  style={styles.mediaActionButton}
                  onPress={() => pickCloseImage(true)}
                >
                  Cámara
                </Button>
              </View>

              {!!closeImageUri && (
                <Button mode="text" onPress={() => setCloseImageUri("")}>
                  Quitar
                </Button>
              )}

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

              {!!closeValidationMessage && (
                <Text variant="labelSmall" style={styles.validationErrorText}>
                  {closeValidationMessage}
                </Text>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  buttonColor="#d32f2f"
                  textColor="#ffffff"
                  onPress={() =>
                    confirmAction(
                      "Descartar cierre",
                      "Se perderan los datos de cierre capturados. Deseas cancelar?",
                      closeCloseEvidence,
                    )
                  }
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={saveCloseEvidence}
                  loading={isSavingClose}
                  disabled={isSavingClose}
                >
                  Guardar cierre
                </Button>
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
              styles.detailsModalCard,
              { paddingBottom: Math.max(10, insets.bottom + 6) },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={styles.detailsModalTitle}>
                Detalles del hallazgo
              </Text>
              <IconButton
                icon="close"
                onPress={() => {
                  setSelectedEvidence(null);
                  setCommentValidationMessage("");
                }}
              />
            </View>
            <Divider />
            {selectedEvidence && (
              <FlatList
                data={selectedEvidence.comments}
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={
                  <View style={styles.detailsBlock}>
                    <View style={styles.detailsTopAccent} />

                    <View style={styles.detailsMetaGrid}>
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Planta</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.manufacturingPlant.name}
                        </Text>
                      </View>
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Grupo</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.mainType.name}
                        </Text>
                      </View>
                      <View style={styles.detailsMetaItemWide}>
                        <Text style={styles.detailsMetaLabel}>Tipo</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.secondaryType.name}
                        </Text>
                      </View>
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Zona</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.zone.name}
                        </Text>
                      </View>
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Creado por</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.user.name}
                        </Text>
                      </View>
                      <View style={styles.detailsMetaItemWide}>
                        <Text style={styles.detailsMetaLabel}>
                          Tiempo abierto
                        </Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedEvidence.solutionDate
                            ? durationToText(
                                selectedEvidence.createdAt,
                                selectedEvidence.solutionDate,
                              )
                            : "En proceso"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailsDescriptionBlock}>
                      <Text style={styles.sectionTitle}>Descripción</Text>
                      <Text style={styles.detailsDescriptionText}>
                        {selectedEvidence.description || "Sin descripción"}
                      </Text>
                    </View>

                    {!!selectedEvidence.descriptionSolution && (
                      <View style={styles.detailsDescriptionBlock}>
                        <Text style={styles.sectionTitle}>Solución</Text>
                        <Text style={styles.detailsDescriptionText}>
                          {selectedEvidence.descriptionSolution}
                        </Text>
                      </View>
                    )}

                    <View style={styles.imagesRow}>
                      {!!selectedEvidence.imgEvidence && (
                        <View
                          style={[
                            styles.detailImageItem,
                            selectedEvidence.imgSolution
                              ? styles.detailImageItemHalf
                              : styles.detailImageItemFull,
                          ]}
                        >
                          <Text style={styles.detailImageLabel}>
                            Imagen del hallazgo
                          </Text>
                          <Pressable
                            onPress={() =>
                              openImagePreview(
                                EvidencesService.imageUrl(
                                  selectedEvidence.imgEvidence!,
                                ),
                                "Imagen del hallazgo",
                              )
                            }
                            style={styles.detailImagePressable}
                          >
                            <View style={styles.detailImageFrame}>
                              <Image
                                source={{
                                  uri: EvidencesService.imageUrl(
                                    selectedEvidence.imgEvidence,
                                  ),
                                }}
                                style={styles.photo}
                              />
                            </View>
                          </Pressable>
                        </View>
                      )}
                      {!!selectedEvidence.imgSolution && (
                        <View
                          style={[
                            styles.detailImageItem,
                            selectedEvidence.imgEvidence
                              ? styles.detailImageItemHalf
                              : styles.detailImageItemFull,
                          ]}
                        >
                          <Text style={styles.detailImageLabel}>
                            Imagen de la solucion
                          </Text>
                          <Pressable
                            onPress={() =>
                              openImagePreview(
                                EvidencesService.imageUrl(
                                  selectedEvidence.imgSolution!,
                                ),
                                "Imagen de la solucion",
                              )
                            }
                            style={styles.detailImagePressable}
                          >
                            <View style={styles.detailImageFrame}>
                              <Image
                                source={{
                                  uri: EvidencesService.imageUrl(
                                    selectedEvidence.imgSolution,
                                  ),
                                }}
                                style={styles.photo}
                              />
                            </View>
                          </Pressable>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sectionTitle}>Comentarios</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Text style={styles.commentAuthor}>{item.user.name}</Text>
                    <Text>{item.comment}</Text>
                    <Text
                      variant="labelSmall"
                      style={styles.detailsCommentDate}
                    >
                      {stringToDateWithTime(item.createdAt)}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.detailsEmptyComments}>
                    Sin comentarios.
                  </Text>
                }
              />
            )}

            <TextInput
              mode="outlined"
              label="Agregar comentario"
              value={newComment}
              onChangeText={(value) => {
                setNewComment(value);
                if (commentValidationMessage) {
                  setCommentValidationMessage("");
                }
              }}
            />
            {!!commentValidationMessage && (
              <Text variant="labelSmall" style={styles.validationErrorText}>
                {commentValidationMessage}
              </Text>
            )}
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                buttonColor="#d32f2f"
                textColor="#ffffff"
                onPress={() => {
                  setSelectedEvidence(null);
                  setCommentValidationMessage("");
                }}
              >
                Cerrar
              </Button>
              <Button
                mode="contained"
                onPress={handleAddComment}
                loading={isSavingComment}
                disabled={isSavingComment}
              >
                Guardar comentario
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <Pressable
          style={styles.imagePreviewBackdrop}
          onPress={closeImagePreview}
        >
          <Pressable style={styles.imagePreviewCard} onPress={() => null}>
            <View style={styles.imagePreviewHeader}>
              <Text style={styles.imagePreviewLabel}>{imagePreviewLabel}</Text>
              <IconButton
                icon="close"
                size={20}
                iconColor="#d1fae5"
                onPress={closeImagePreview}
                style={styles.imagePreviewCloseButton}
              />
            </View>
            {!!imagePreviewUri && (
              <Image
                source={{ uri: imagePreviewUri }}
                style={styles.imagePreviewImage}
                resizeMode="contain"
              />
            )}
          </Pressable>
        </Pressable>
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
    backgroundColor: "#fbfef9",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dbe9d1",
  },
  headerAccent: {
    width: 4,
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#71BF44",
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    color: "#2f6d21",
  },
  headerSubtitle: {
    color: "#4f5f4f",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mediaActionsRow: {
    marginBottom: 10,
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  mediaActionButton: {
    flex: 1,
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
    color: "#1f2937",
    backgroundColor: "#ffffff",
    height: Platform.OS === "android" ? 50 : undefined,
  },
  loadingRows: {
    marginVertical: 16,
  },
  listContent: {
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe9d1",
    backgroundColor: "#fbfef9",
  },
  cardContent: {
    gap: 4,
  },
  cardTopAccent: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#71BF44",
    marginBottom: 6,
  },
  cardIdText: {
    color: "#2f6d21",
    fontWeight: "700",
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
  metaItemWide: {
    width: "100%",
  },
  metaLabel: {
    fontSize: 12,
    color: "#4b8f2e",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "400",
  },
  metaValueStrong: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "400",
    lineHeight: 18,
  },
  descriptionBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4efdd",
    gap: 2,
  },
  descriptionValue: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 20,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardActionButton: {
    flex: 1,
    minWidth: 140,
  },
  cardActionButtonFull: {
    width: "100%",
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
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  confirmCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe9d1",
    padding: 14,
    gap: 10,
  },
  confirmTitle: {
    color: "#1f2937",
    fontWeight: "700",
  },
  confirmMessage: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmPrimaryButton: {
    minWidth: 140,
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
    gap: 8,
    paddingVertical: 8,
  },
  detailsModalCard: {
    borderWidth: 1,
    borderColor: "#dbe9d1",
    backgroundColor: "#fbfef9",
    borderRadius: 14,
  },
  detailsModalTitle: {
    color: "#2f6d21",
    fontWeight: "700",
  },
  detailsTopAccent: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#71BF44",
  },
  detailsMetaGrid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 8,
  },
  detailsMetaItem: {
    width: "48%",
  },
  detailsMetaItemWide: {
    width: "100%",
  },
  detailsMetaLabel: {
    fontSize: 11,
    color: "#4b8f2e",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontWeight: "700",
  },
  detailsMetaValue: {
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 20,
  },
  detailsDescriptionBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e4efdd",
    paddingTop: 8,
    gap: 2,
  },
  detailsDescriptionText: {
    color: "#4b5563",
    fontSize: 16,
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: 8,
    fontWeight: "700",
    color: "#2f6d21",
  },
  imagesRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  detailImageItem: {
    gap: 6,
  },
  detailImageItemHalf: {
    width: "48%",
  },
  detailImageItemFull: {
    width: "100%",
  },
  detailImageLabel: {
    color: "#4b8f2e",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailImagePressable: {
    width: "100%",
  },
  detailImageFrame: {
    borderWidth: 1,
    borderColor: "#dbe9d1",
    borderRadius: 10,
    padding: 2,
    backgroundColor: "#ffffff",
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#eef1f5",
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  imagePreviewCard: {
    width: "96%",
    maxHeight: "88%",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#71BF44",
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  imagePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  imagePreviewLabel: {
    color: "#d1fae5",
    fontWeight: "700",
    flex: 1,
    fontSize: 15,
  },
  imagePreviewCloseButton: {
    margin: 0,
  },
  imagePreviewImage: {
    width: "100%",
    height: "92%",
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  commentItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e4efdd",
    borderLeftWidth: 3,
    borderLeftColor: "#71BF44",
    backgroundColor: "#f7faf5",
    borderRadius: 8,
    gap: 2,
  },
  commentAuthor: {
    fontWeight: "700",
    color: "#2f6d21",
  },
  detailsCommentDate: {
    color: "#6b7280",
  },
  detailsEmptyComments: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  modalActions: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  validationErrorText: {
    color: "#d32f2f",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    fontSize: 16,
  },
});
