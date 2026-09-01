"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Expand,
  Focus,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Move,
  Network,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { PanelCardGridSkeleton } from "@/components/ui/loading-states";
import {
  Employee,
  OrganigramPayload,
  OrganizationUnit,
  Position,
  hrFetch,
} from "@/modules/humanresources/api";
import { invalidateHrEmployeeQueries } from "@/modules/humanresources/query-invalidation";

type PersonTreeNode = {
  employee: Employee;
  children: PersonTreeNode[];
};

type UnitTreeNode = {
  unit: OrganizationUnit;
  children: UnitTreeNode[];
};

type ChartNode = {
  key: string;
  kind: "person" | "unit";
  title: string;
  subtitle: string;
  eyebrow: string;
  children: ChartNode[];
  employee?: Employee;
  unit?: OrganizationUnit;
  peopleCount: number;
  vacancyCount: number;
};

type PositionedNode = {
  node: ChartNode;
  x: number;
  y: number;
  depth: number;
};

type ChartEdge = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type ChartLayout = {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: ChartEdge[];
};

const NODE_WIDTH = 276;
const NODE_HEIGHT = 116;
const HORIZONTAL_GAP = 38;
const VERTICAL_GAP = 126;
const CANVAS_PADDING = 52;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 1.45;
const currentStatuses = new Set(["active", "probation", "on_leave"]);
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function employeeMatches(
  employee: Employee,
  search: string,
  unitId: string,
  status: string,
) {
  const assignment = employee.primary_assignment;
  const matchesUnit =
    !unitId || assignment?.organization_unit_id === Number(unitId);
  const matchesStatus =
    status === "all"
      ? true
      : status === "current"
        ? currentStatuses.has(employee.employment_status)
        : employee.employment_status === status;
  const haystack = [
    employee.primary_name,
    employee.employee_number,
    employee.work_email,
    assignment?.position?.title,
    assignment?.organization_unit?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return matchesUnit && matchesStatus && haystack.includes(search.toLowerCase());
}

function buildPersonForest(employees: Employee[]): PersonTreeNode[] {
  const nodes = new Map<number, PersonTreeNode>(
    employees.map((employee) => [employee.id, { employee, children: [] }]),
  );
  const roots: PersonTreeNode[] = [];

  nodes.forEach((node) => {
    const managerId = node.employee.primary_assignment?.reports_to_employee_id;
    const manager = managerId ? nodes.get(managerId) : undefined;
    if (manager && manager.employee.id !== node.employee.id) {
      manager.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: PersonTreeNode[]) => {
    items.sort((a, b) => {
      const managerialDifference =
        Number(Boolean(b.employee.primary_assignment?.position?.is_managerial)) -
        Number(Boolean(a.employee.primary_assignment?.position?.is_managerial));
      return (
        managerialDifference ||
        a.employee.primary_name.localeCompare(b.employee.primary_name)
      );
    });
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  if (!roots.length && nodes.size) {
    const first = nodes.values().next().value as PersonTreeNode | undefined;
    if (first) roots.push(first);
  }

  return roots;
}

function buildUnitForest(units: OrganizationUnit[]): UnitTreeNode[] {
  const nodes = new Map<number, UnitTreeNode>(
    units.map((unit) => [unit.id, { unit, children: [] }]),
  );
  const roots: UnitTreeNode[] = [];

  nodes.forEach((node) => {
    const parent = node.unit.parent_id
      ? nodes.get(node.unit.parent_id)
      : undefined;
    if (parent && parent.unit.id !== node.unit.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: UnitTreeNode[]) => {
    items.sort((a, b) => a.unit.name.localeCompare(b.unit.name));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  return roots;
}

function findPersonNode(
  nodes: PersonTreeNode[],
  employeeId: number,
): PersonTreeNode | null {
  for (const node of nodes) {
    if (node.employee.id === employeeId) return node;
    const nested = findPersonNode(node.children, employeeId);
    if (nested) return nested;
  }
  return null;
}

function statusStyle(status: string) {
  if (status === "active")
    return "border-emerald-200 bg-emerald-100 text-emerald-950";
  if (status === "probation")
    return "border-amber-200 bg-amber-100 text-amber-950";
  if (status === "on_leave")
    return "border-blue-200 bg-blue-100 text-blue-950";
  return "border-slate-200 bg-slate-100 text-slate-950";
}

function nodePalette(depth: number, kind: ChartNode["kind"]) {
  if (depth === 0)
    return kind === "unit"
      ? "from-[#172554] via-[#1e3a8a] to-[#1e40af] text-white"
      : "from-[#102a43] via-[#173f68] to-[#1d4f91] text-white";
  if (depth === 1)
    return kind === "unit"
      ? "from-[#064e3b] via-[#0f5c55] to-[#0f766e] text-white"
      : "from-[#134e4a] via-[#0f5f59] to-[#0f766e] text-white";
  return kind === "unit"
    ? "from-[#4a1942] via-[#632452] to-[#7a285d] text-white"
    : "from-[#3f1838] via-[#572047] to-[#702653] text-white";
}

function flattenNodes(nodes: ChartNode[]): ChartNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function layoutChart(roots: ChartNode[], collapsed: Set<string>): ChartLayout {
  const widths = new Map<string, number>();
  const measuring = new Set<string>();

  const measure = (node: ChartNode): number => {
    if (measuring.has(node.key)) return NODE_WIDTH;
    measuring.add(node.key);
    const children = collapsed.has(node.key) ? [] : node.children;
    const childWidth = children.length
      ? children.reduce((total, child) => total + measure(child), 0) +
        HORIZONTAL_GAP * (children.length - 1)
      : 0;
    const width = Math.max(NODE_WIDTH, childWidth);
    widths.set(node.key, width);
    measuring.delete(node.key);
    return width;
  };

  const forestWidth = roots.length
    ? roots.reduce((total, root) => total + measure(root), 0) +
      HORIZONTAL_GAP * (roots.length - 1)
    : NODE_WIDTH;
  const nodes: PositionedNode[] = [];
  const edges: ChartEdge[] = [];
  let maxDepth = 0;
  const positioning = new Set<string>();

  const place = (
    node: ChartNode,
    startX: number,
    depth: number,
    parent?: PositionedNode,
  ) => {
    if (positioning.has(node.key)) return;
    positioning.add(node.key);
    maxDepth = Math.max(maxDepth, depth);
    const subtreeWidth = widths.get(node.key) ?? NODE_WIDTH;
    const positioned: PositionedNode = {
      node,
      x: startX + (subtreeWidth - NODE_WIDTH) / 2 + CANVAS_PADDING,
      y: CANVAS_PADDING + depth * (NODE_HEIGHT + VERTICAL_GAP),
      depth,
    };
    nodes.push(positioned);
    if (parent) {
      edges.push({
        fromX: parent.x + NODE_WIDTH / 2,
        fromY: parent.y + NODE_HEIGHT,
        toX: positioned.x + NODE_WIDTH / 2,
        toY: positioned.y,
      });
    }

    if (!collapsed.has(node.key)) {
      let childX = startX;
      node.children.forEach((child) => {
        place(child, childX, depth + 1, positioned);
        childX += (widths.get(child.key) ?? NODE_WIDTH) + HORIZONTAL_GAP;
      });
    }
    positioning.delete(node.key);
  };

  let rootX = 0;
  roots.forEach((root) => {
    place(root, rootX, 0);
    rootX += (widths.get(root.key) ?? NODE_WIDTH) + HORIZONTAL_GAP;
  });

  return {
    width: Math.max(720, forestWidth + CANVAS_PADDING * 2),
    height: Math.max(
      470,
      CANVAS_PADDING * 2 + (maxDepth + 1) * NODE_HEIGHT + maxDepth * VERTICAL_GAP,
    ),
    nodes,
    edges,
  };
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncated(value: string, length = 35) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function chartSvg(layout: ChartLayout) {
  const paths = layout.edges
    .map((edge) => {
      const bend = Math.max(32, (edge.toY - edge.fromY) * 0.5);
      return `<path d="M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${edge.fromY + bend}, ${edge.toX} ${edge.toY - bend}, ${edge.toX} ${edge.toY}" fill="none" stroke="#6b8791" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join("");
  const nodes = layout.nodes
    .map(({ node, x, y, depth }) => {
      const colors =
        depth === 0
          ? node.kind === "unit"
            ? ["#172554", "#1e40af"]
            : ["#102a43", "#1d4f91"]
          : depth === 1
            ? node.kind === "unit"
              ? ["#064e3b", "#0f766e"]
              : ["#134e4a", "#0f766e"]
            : node.kind === "unit"
              ? ["#4a1942", "#7a285d"]
              : ["#3f1838", "#702653"];
      const gradientId = `gradient-${node.key.replaceAll(/[^a-zA-Z0-9]/g, "")}`;
      return `<g>
        <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>
        <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="20" fill="url(#${gradientId})"/>
        <circle cx="${x + 34}" cy="${y + 43}" r="20" fill="#fcd34d"/>
        <text x="${x + 34}" y="${y + 48}" fill="#172033" font-family="Arial, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${xmlEscape(node.kind === "person" ? initials(node.title) : node.eyebrow.slice(0, 2).toUpperCase())}</text>
        <text x="${x + 66}" y="${y + 24}" fill="#d9f8f5" font-family="Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="1">${xmlEscape(truncated(node.eyebrow.toUpperCase(), 29))}</text>
        <text x="${x + 66}" y="${y + 48}" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700">${xmlEscape(truncated(node.title, 25))}</text>
        <text x="${x + 66}" y="${y + 68}" fill="#e7f5f4" font-family="Arial, sans-serif" font-size="11">${xmlEscape(truncated(node.subtitle, 31))}</text>
        <rect x="${x + 18}" y="${y + 86}" width="112" height="20" rx="10" fill="#071b24" fill-opacity=".4"/>
        <text x="${x + 74}" y="${y + 100}" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${node.peopleCount} ${node.kind === "person" ? "DIRECT REPORTS" : "PEOPLE"}</text>
        <rect x="${x + 138}" y="${y + 86}" width="120" height="20" rx="10" fill="#071b24" fill-opacity=".4"/>
        <text x="${x + 198}" y="${y + 100}" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${node.kind === "unit" ? `${node.vacancyCount} OPEN SEATS` : xmlEscape(truncated(node.employee?.employment_status.replaceAll("_", " ").toUpperCase() ?? "", 17))}</text>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
    <defs>
      <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#bdd0d5" stroke-width="1" opacity=".5"/></pattern>
    </defs>
    <rect width="100%" height="100%" fill="#edf3f4"/>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    ${paths}
    ${nodes}
  </svg>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function OrganigramPanel({
  canManage,
  onEditEmployee,
  statusOptions,
}: {
  canManage: boolean;
  onEditEmployee: (employee: Employee) => void;
  statusOptions: Array<{ code: string; label: string }>;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [unitId, setUnitId] = useState("");
  const [status, setStatus] = useState("current");
  const [view, setView] = useState<"people" | "units">("people");
  const [showVacancies, setShowVacancies] = useState(true);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [focusRootId, setFocusRootId] = useState<number | null>(null);
  const [managerId, setManagerId] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingFocusKey, setPendingFocusKey] = useState<string | null>(null);

  const organigram = useQuery({
    queryKey: ["hr-organigram", scope],
    queryFn: () => hrFetch<OrganigramPayload>("/organigram"),
  });
  const employees = organigram.data?.data ?? [];
  const units = organigram.data?.units ?? [];
  const positions = organigram.data?.positions ?? [];
  const selectedPerson =
    employees.find((employee) => employee.id === selectedPersonId) ?? null;
  const selectedUnit =
    units.find((unit) => unit.id === selectedUnitId) ?? null;

  const baseFiltered = useMemo(
    () =>
      employees.filter((employee) =>
        employeeMatches(employee, search.trim(), unitId, status),
      ),
    [employees, search, status, unitId],
  );
  const matchedEmployeeIds = useMemo(
    () => new Set(baseFiltered.map((employee) => employee.id)),
    [baseFiltered],
  );
  const visibleEmployees = useMemo(() => {
    if (!search.trim()) return baseFiltered;
    const allById = new Map(employees.map((employee) => [employee.id, employee]));
    const include = new Set(baseFiltered.map((employee) => employee.id));
    baseFiltered.forEach((employee) => {
      let currentManagerId =
        employee.primary_assignment?.reports_to_employee_id;
      const visited = new Set<number>();
      while (currentManagerId && !visited.has(currentManagerId)) {
        visited.add(currentManagerId);
        include.add(currentManagerId);
        currentManagerId = allById.get(currentManagerId)?.primary_assignment
          ?.reports_to_employee_id;
      }
    });
    return employees.filter((employee) => include.has(employee.id));
  }, [baseFiltered, employees, search]);

  const personForest = useMemo(
    () => buildPersonForest(visibleEmployees),
    [visibleEmployees],
  );
  const focusedPersonForest = useMemo(() => {
    if (!focusRootId) return personForest;
    const focused = findPersonNode(personForest, focusRootId);
    return focused ? [focused] : personForest;
  }, [focusRootId, personForest]);
  const unitForest = useMemo(() => buildUnitForest(units), [units]);
  const employeesByUnit = useMemo(() => {
    const map = new Map<number, Employee[]>();
    visibleEmployees.forEach((employee) => {
      const id = employee.primary_assignment?.organization_unit_id;
      if (!id) return;
      map.set(id, [...(map.get(id) ?? []), employee]);
    });
    return map;
  }, [visibleEmployees]);
  const positionsByUnit = useMemo(() => {
    const map = new Map<number, Position[]>();
    positions.forEach((position) => {
      map.set(position.organization_unit_id, [
        ...(map.get(position.organization_unit_id) ?? []),
        position,
      ]);
    });
    return map;
  }, [positions]);

  const personChartRoots = useMemo(() => {
    const convert = (treeNode: PersonTreeNode): ChartNode => {
      const employee = treeNode.employee;
      return {
        key: `person-${employee.id}`,
        kind: "person",
        title: employee.primary_name,
        subtitle:
          employee.primary_assignment?.position?.title ??
          "Position not assigned",
        eyebrow:
          employee.primary_assignment?.organization_unit?.name ??
          "Unassigned team",
        children: treeNode.children.map(convert),
        employee,
        peopleCount: treeNode.children.length,
        vacancyCount: 0,
      };
    };
    return focusedPersonForest.map(convert);
  }, [focusedPersonForest]);
  const unitChartRoots = useMemo(() => {
    const convert = (treeNode: UnitTreeNode): ChartNode => {
      const unitPeople = employeesByUnit.get(treeNode.unit.id) ?? [];
      const vacancies = (positionsByUnit.get(treeNode.unit.id) ?? []).reduce(
        (total, position) => total + position.vacant_headcount,
        0,
      );
      const leader =
        unitPeople.find(
          (employee) =>
            employee.primary_assignment?.position?.is_managerial,
        ) ?? unitPeople[0];
      return {
        key: `unit-${treeNode.unit.id}`,
        kind: "unit",
        title: treeNode.unit.name,
        subtitle: leader
          ? `Lead: ${leader.primary_name}`
          : "Leadership seat unassigned",
        eyebrow: `${treeNode.unit.unit_type} · ${treeNode.unit.code}`,
        children: treeNode.children.map(convert),
        unit: treeNode.unit,
        peopleCount: unitPeople.length,
        vacancyCount: showVacancies ? vacancies : 0,
      };
    };
    const converted = unitForest.map(convert);
    if (!unitId) return converted;
    const find = (nodes: ChartNode[]): ChartNode | null => {
      for (const node of nodes) {
        if (node.unit?.id === Number(unitId)) return node;
        const nested = find(node.children);
        if (nested) return nested;
      }
      return null;
    };
    const selected = find(converted);
    return selected ? [selected] : converted;
  }, [
    employeesByUnit,
    positionsByUnit,
    showVacancies,
    unitForest,
    unitId,
  ]);
  const chartRoots = view === "people" ? personChartRoots : unitChartRoots;
  const layout = useMemo(
    () => layoutChart(chartRoots, collapsed),
    [chartRoots, collapsed],
  );
  const branchKeys = useMemo(
    () =>
      flattenNodes(chartRoots)
        .filter((node) => node.children.length)
        .map((node) => node.key),
    [chartRoots],
  );

  const directReports = useMemo(
    () =>
      selectedPerson
        ? employees.filter(
            (employee) =>
              employee.primary_assignment?.reports_to_employee_id ===
              selectedPerson.id,
          )
        : [],
    [employees, selectedPerson],
  );
  const descendants = useMemo(() => {
    if (!selectedPerson) return new Set<number>();
    const result = new Set<number>();
    const childrenByManager = new Map<number, Employee[]>();
    employees.forEach((employee) => {
      const id = employee.primary_assignment?.reports_to_employee_id;
      if (!id) return;
      childrenByManager.set(id, [
        ...(childrenByManager.get(id) ?? []),
        employee,
      ]);
    });
    const collect = (employeeId: number) => {
      (childrenByManager.get(employeeId) ?? []).forEach((employee) => {
        if (result.has(employee.id)) return;
        result.add(employee.id);
        collect(employee.id);
      });
    };
    collect(selectedPerson.id);
    return result;
  }, [employees, selectedPerson]);

  const selectedUnitPeople = useMemo(
    () =>
      selectedUnit
        ? employees.filter(
            (employee) =>
              employee.primary_assignment?.organization_unit_id ===
              selectedUnit.id,
          )
        : [],
    [employees, selectedUnit],
  );
  const selectedUnitPositions = useMemo(
    () =>
      selectedUnit
        ? positions.filter(
            (position) =>
              position.organization_unit_id === selectedUnit.id,
          )
        : [],
    [positions, selectedUnit],
  );

  useEffect(() => {
    setManagerId(
      selectedPerson?.primary_assignment?.reports_to_employee_id
        ? String(
            selectedPerson.primary_assignment.reports_to_employee_id,
          )
        : "",
    );
  }, [selectedPerson]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const centerNode = useCallback(
    (key: string) => {
      const viewport = viewportRef.current;
      const positioned = layout.nodes.find((item) => item.node.key === key);
      if (!viewport || !positioned) return false;
      setPan({
        x:
          viewport.clientWidth / 2 -
          (positioned.x + NODE_WIDTH / 2) * zoom,
        y:
          viewport.clientHeight / 2 -
          (positioned.y + NODE_HEIGHT / 2) * zoom,
      });
      return true;
    },
    [layout.nodes, zoom],
  );

  const fitChart = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !layout.nodes.length) return;
    const nextZoom = clampZoom(
      Math.min(
        (viewport.clientWidth - 64) / layout.width,
        (viewport.clientHeight - 76) / layout.height,
        1,
      ),
    );
    setZoom(nextZoom);
    setPan({
      x: (viewport.clientWidth - layout.width * nextZoom) / 2,
      y: (viewport.clientHeight - layout.height * nextZoom) / 2,
    });
  }, [layout.height, layout.nodes.length, layout.width]);

  useEffect(() => {
    const timer = window.setTimeout(fitChart, 80);
    return () => window.clearTimeout(timer);
  }, [fitChart, view, unitId, focusRootId]);

  useEffect(() => {
    if (!pendingFocusKey) return;
    if (centerNode(pendingFocusKey)) setPendingFocusKey(null);
  }, [centerNode, layout.nodes, pendingFocusKey]);

  const managerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPerson?.primary_assignment)
        throw new Error("Assign a position before changing the reporting line.");
      const assignment = selectedPerson.primary_assignment;
      return hrFetch(
        `/employees/${selectedPerson.id}/assignments/${assignment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            organization_unit_id: assignment.organization_unit_id,
            position_id: assignment.position_id,
            reports_to_employee_id: managerId ? Number(managerId) : null,
            assignment_type: assignment.assignment_type,
            started_on: assignment.started_on,
            ended_on: assignment.ended_on,
            full_time_equivalent: assignment.full_time_equivalent,
            hours_per_day: assignment.hours_per_day,
            hours_per_week: assignment.hours_per_week,
            is_primary: assignment.is_primary,
            change_reason: "Reporting line updated from HR organigram",
          }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Reporting line updated.");
      void invalidateHrEmployeeQueries(queryClient, { scope });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "The reporting line could not be updated.",
      ),
  });

  const jumpToEmployee = (employee: Employee) => {
    const managerKeys = new Set<string>();
    const allById = new Map(employees.map((item) => [item.id, item]));
    let current = employee.primary_assignment?.reports_to_employee_id;
    const visited = new Set<number>();
    while (current && !visited.has(current)) {
      visited.add(current);
      managerKeys.add(`person-${current}`);
      current = allById.get(current)?.primary_assignment
        ?.reports_to_employee_id;
    }
    setFocusRootId(null);
    setCollapsed((existing) => {
      const next = new Set(existing);
      managerKeys.forEach((key) => next.delete(key));
      return next;
    });
    setPendingFocusKey(`person-${employee.id}`);
    setSelectedPersonId(employee.id);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await viewportRef.current?.requestFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available in this browser.");
    }
  };

  const changeZoom = (amount: number) => {
    setZoom((current) => clampZoom(current + amount));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(
        "button, input, select, a, summary",
      )
    )
      return;
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.panX + event.clientX - drag.originX,
      y: drag.panY + event.clientY - drag.originY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    changeZoom(event.deltaY > 0 ? -0.08 : 0.08);
  };

  const handleCanvasKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const distance = event.shiftKey ? 120 : 48;
    const delta =
      event.key === "ArrowLeft"
        ? { x: distance, y: 0 }
        : event.key === "ArrowRight"
          ? { x: -distance, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: distance }
            : event.key === "ArrowDown"
              ? { x: 0, y: -distance }
              : null;
    if (delta) {
      event.preventDefault();
      setPan((current) => ({
        x: current.x + delta.x,
        y: current.y + delta.y,
      }));
    }
  };

  const exportCsv = () => {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Employee", "Employee number", "Position", "Unit", "Manager", "Status"],
      ...visibleEmployees.map((employee) => [
        employee.primary_name,
        employee.employee_number,
        employee.primary_assignment?.position?.title ?? "",
        employee.primary_assignment?.organization_unit?.name ?? "",
        employee.primary_assignment?.reports_to?.primary_name ?? "",
        employee.employment_status,
      ]),
    ];
    downloadBlob(
      new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
      "hr-organigram.csv",
    );
  };

  const exportSvg = () => {
    downloadBlob(
      new Blob([chartSvg(layout)], {
        type: "image/svg+xml;charset=utf-8",
      }),
      `hr-${view}-organigram.svg`,
    );
  };

  const exportPng = () => {
    const svg = chartSvg(layout);
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const image = new Image();
    image.onload = () => {
      const exportScale = Math.min(
        2,
        7600 / layout.width,
        7600 / layout.height,
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(layout.width * exportScale);
      canvas.height = Math.round(layout.height * exportScale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        toast.error("The PNG export could not be created.");
        return;
      }
      context.scale(exportScale, exportScale);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          toast.error("The PNG export could not be created.");
          return;
        }
        downloadBlob(blob, `hr-${view}-organigram.png`);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("The PNG export could not be created.");
    };
    image.src = url;
  };

  const handleExport = (value: string) => {
    if (value === "svg") exportSvg();
    if (value === "png") exportPng();
    if (value === "csv") exportCsv();
    if (value === "print") window.print();
  };

  const reset = () => {
    setSearch("");
    setUnitId("");
    setStatus("current");
    setFocusRootId(null);
    setCollapsed(new Set());
    setSelectedPersonId(null);
    setSelectedUnitId(null);
    window.setTimeout(fitChart, 50);
  };

  if (organigram.isLoading)
    return (
      <div className="space-y-4" role="status" aria-label="Loading organigram">
        <div className="flex flex-wrap gap-3">
          <div className="h-11 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-11 w-36 animate-pulse rounded-xl bg-muted" />
          <div className="h-11 w-28 animate-pulse rounded-xl bg-muted" />
        </div>
        <Card className="border-border/50">
          <CardContent className="space-y-4 p-6">
            <div className="mx-auto h-16 w-56 animate-pulse rounded-2xl bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          </CardContent>
        </Card>
        <PanelCardGridSkeleton count={2} className="lg:grid-cols-2" />
      </div>
    );

  if (organigram.isError)
    return (
      <Card className="border-red-700 bg-red-50 dark:border-red-300 dark:bg-red-950">
        <CardContent className="p-6">
          <p role="alert" className="font-bold text-red-900 dark:text-red-100">
            The organigram could not be loaded. Refresh the page or verify the
            HR API is available.
          </p>
        </CardContent>
      </Card>
    );

  const selectedUnitVacancies = selectedUnitPositions.reduce(
    (total, position) => total + position.vacant_headcount,
    0,
  );

  return (
    <section aria-labelledby="organigram-heading" className="space-y-5">
      <header className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-[#071b24] px-5 py-6 text-white shadow-[0_24px_70px_-34px_rgba(2,22,31,0.85)] sm:px-7 lg:px-9 lg:py-8">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[54px] border-cyan-300/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-amber-300">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                Interactive organization intelligence
              </p>
            </div>
            <h2
              id="organigram-heading"
              className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl"
            >
              See the whole organization. Shape it with confidence.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
              Explore people and department hierarchies, inspect capacity, find
              any role instantly, and safely update reporting lines from one
              living map.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-300" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-200">Live HR data</p>
              <p className="text-sm font-black">
                {organigram.data?.meta.total_employees ?? 0} people mapped
              </p>
            </div>
          </div>
        </div>
        <dl className="relative mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["People", organigram.data?.meta.total_employees ?? 0],
            ["Assigned", organigram.data?.meta.assigned_employees ?? 0],
            ["Unassigned", organigram.data?.meta.unassigned_employees ?? 0],
            ["Top-level leads", organigram.data?.meta.reporting_roots ?? 0],
            ["Open seats", organigram.data?.meta.vacant_positions ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-[#0b2935]/95 p-4">
              <dt className="text-xs font-bold text-slate-200">{label}</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="overflow-hidden rounded-[2rem] border border-slate-400 bg-white shadow-[0_18px_60px_-38px_rgba(15,23,42,0.7)] dark:border-slate-600 dark:bg-slate-950">
        <form
          aria-label="Organigram filters"
          onSubmit={(event) => event.preventDefault()}
          className="grid gap-4 border-b border-slate-300 p-4 sm:p-5 lg:grid-cols-[minmax(17rem,1.45fr)_1fr_1fr_auto] dark:border-slate-700"
        >
          <div>
            <Label htmlFor="organigram-search">Find a person, role, or team</Label>
            <div className="relative mt-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-600 dark:text-slate-300"
              />
              <Input
                id="organigram-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-describedby="organigram-search-help"
                placeholder="Try a name, job title, or unit"
                className="h-11 border-slate-500 pl-10 focus-visible:ring-teal-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </div>
            <p id="organigram-search-help" className="sr-only">
              Search by name, employee number, email, role, or organization
              unit.
            </p>
          </div>
          <div>
            <Label htmlFor="organigram-unit">Organization unit</Label>
            <select
              id="organigram-unit"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className={cn(selectClass, "mt-2")}
            >
              <option value="">All units</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="organigram-status">Employment status</Label>
            <select
              id="organigram-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={cn(selectClass, "mt-2")}
            >
              <option value="current">Current workforce</option>
              <option value="all">All records</option>
              {statusOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              className="min-h-11 w-full border-slate-500"
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          </div>
        </form>

        {search.trim() && (
          <section
            aria-labelledby="quick-jump-heading"
            className="border-b border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="quick-jump-heading"
                className="mr-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200"
              >
                Quick jump
              </h3>
              {baseFiltered.slice(0, 6).map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => jumpToEmployee(employee)}
                  className="min-h-11 rounded-full border border-slate-400 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition hover:border-teal-700 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-500 dark:bg-slate-950 dark:text-white dark:hover:border-amber-300 dark:hover:bg-slate-800 dark:focus-visible:ring-amber-300"
                >
                  {employee.primary_name}
                </button>
              ))}
              {!baseFiltered.length && (
                <p role="status" className="text-sm font-semibold">
                  No matching people found.
                </p>
              )}
              {baseFiltered.length > 6 && (
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  +{baseFiltered.length - 6} more on the map
                </p>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap gap-2" aria-label="Organigram view">
            <Button
              type="button"
              variant={view === "people" ? "default" : "outline"}
              aria-pressed={view === "people"}
              onClick={() => {
                setView("people");
                setCollapsed(new Set());
              }}
              className={cn(
                "min-h-11",
                view === "people" && "bg-[#0f5961] hover:bg-[#0b4950]",
              )}
            >
              <Network aria-hidden="true" />
              People hierarchy
            </Button>
            <Button
              type="button"
              variant={view === "units" ? "default" : "outline"}
              aria-pressed={view === "units"}
              onClick={() => {
                setView("units");
                setCollapsed(new Set());
              }}
              className={cn(
                "min-h-11",
                view === "units" && "bg-[#0f5961] hover:bg-[#0b4950]",
              )}
            >
              <Building2 aria-hidden="true" />
              Department hierarchy
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {view === "units" && (
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-500 px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={showVacancies}
                  onChange={(event) => setShowVacancies(event.target.checked)}
                  className="h-5 w-5 accent-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                />
                Show open seats
              </label>
            )}
            <p
              role="status"
              className="text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              {view === "people"
                ? `${visibleEmployees.length} of ${employees.length} people`
                : `${layout.nodes.length} organization units`}
            </p>
          </div>
        </div>

        {focusRootId && view === "people" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <p className="text-sm font-bold">
              Focus mode: showing{" "}
              {employees.find((employee) => employee.id === focusRootId)
                ?.primary_name ?? "selected leader"}
              ’s branch.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFocusRootId(null)}
              className="min-h-11 border-amber-700 bg-white text-amber-950 hover:bg-amber-100"
            >
              <Expand aria-hidden="true" />
              Show whole organization
            </Button>
          </div>
        )}

        <figure
          aria-labelledby="organigram-heading"
          aria-describedby="organigram-description"
          className="relative"
        >
          <figcaption className="sr-only">
            Interactive organization hierarchy with selectable people and
            departments.
          </figcaption>
          <p id="organigram-description" className="sr-only">
            The current {view === "people" ? "people" : "department"} map has{" "}
            {layout.nodes.length} nodes and {layout.edges.length} reporting
            connections. Connections run from a manager or parent department
            down to their direct reports or child departments. Select any card
            for details. Use arrow keys while the map is focused to pan it.
          </p>

          <div
            ref={viewportRef}
            role="region"
            aria-label={`${view === "people" ? "People" : "Department"} hierarchy canvas`}
            tabIndex={0}
            onKeyDown={handleCanvasKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className={cn(
              "group/canvas relative h-[43rem] min-h-[31rem] overflow-hidden bg-[#eaf1f2] outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-700 dark:bg-[#071b24] dark:focus-visible:ring-amber-300",
              isFullscreen && "h-screen w-screen",
            )}
            style={{
              touchAction: "none",
              backgroundImage:
                "linear-gradient(rgba(45,83,93,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(45,83,93,.11) 1px, transparent 1px), radial-gradient(circle at 15% 10%, rgba(14,116,144,.13), transparent 28%), radial-gradient(circle at 85% 80%, rgba(15,118,110,.13), transparent 30%)",
              backgroundSize:
                "28px 28px, 28px 28px, 100% 100%, 100% 100%",
            }}
          >
            <div className="absolute left-3 top-3 z-30 max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl backdrop-blur-md dark:border-slate-600 dark:bg-slate-950/90">
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => changeZoom(-0.1)}
                  disabled={zoom <= MIN_ZOOM}
                  className="min-h-11"
                >
                  <ZoomOut aria-hidden="true" />
                  Zoom out
                </Button>
                <span
                  aria-live="polite"
                  className="min-w-14 text-center text-xs font-black tabular-nums"
                >
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => changeZoom(0.1)}
                  disabled={zoom >= MAX_ZOOM}
                  className="min-h-11"
                >
                  <ZoomIn aria-hidden="true" />
                  Zoom in
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={fitChart}
                  className="min-h-11"
                >
                  <Maximize2 aria-hidden="true" />
                  Fit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCollapsed(
                      collapsed.size ? new Set() : new Set(branchKeys),
                    )
                  }
                  className="min-h-11"
                >
                  <ArrowDownToLine aria-hidden="true" />
                  {collapsed.size ? "Expand all" : "Collapse all"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={toggleFullscreen}
                  className="min-h-11"
                >
                  {isFullscreen ? (
                    <Minimize2 aria-hidden="true" />
                  ) : (
                    <Expand aria-hidden="true" />
                  )}
                  {isFullscreen ? "Exit full screen" : "Full screen"}
                </Button>
              </div>
            </div>

            <div className="absolute right-3 top-3 z-30 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl backdrop-blur-md dark:border-slate-600 dark:bg-slate-950/90">
              <Label htmlFor="organigram-export" className="sr-only">
                Export organigram
              </Label>
              <select
                id="organigram-export"
                defaultValue=""
                onChange={(event) => {
                  handleExport(event.target.value);
                  event.target.value = "";
                }}
                className="h-11 rounded-xl border border-slate-500 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-400 dark:bg-slate-950 dark:text-white dark:focus-visible:ring-amber-300"
              >
                <option value="" disabled>
                  Export chart…
                </option>
                <option value="png">Download PNG</option>
                <option value="svg">Download SVG</option>
                <option value="csv">Download people CSV</option>
                <option value="print">Print / save as PDF</option>
              </select>
            </div>

            {!layout.nodes.length ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                <div className="rounded-3xl border border-slate-400 bg-white/95 p-8 shadow-xl dark:border-slate-600 dark:bg-slate-950/95">
                  <UsersRound
                    aria-hidden="true"
                    className="mx-auto h-10 w-10 text-teal-800 dark:text-amber-300"
                  />
                  <h3 className="mt-4 text-lg font-black">
                    No records match these filters
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    Reset the filters or choose a different organization unit.
                  </p>
                </div>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="absolute left-0 top-0 transition-transform duration-150 ease-out"
                style={{
                  width: layout.width,
                  height: layout.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                <svg
                  width={layout.width}
                  height={layout.height}
                  className="pointer-events-none absolute inset-0"
                >
                  {layout.edges.map((edge, index) => {
                    const bend = Math.max(
                      32,
                      (edge.toY - edge.fromY) * 0.5,
                    );
                    return (
                      <path
                        key={`${edge.fromX}-${edge.toX}-${index}`}
                        d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${edge.fromY + bend}, ${edge.toX} ${edge.toY - bend}, ${edge.toX} ${edge.toY}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="text-[#6b8791] dark:text-[#8eb7bd]"
                      />
                    );
                  })}
                </svg>
              </div>
            )}

            <div
              className="absolute left-0 top-0 transition-transform duration-150 ease-out"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {layout.nodes.map(({ node, x, y, depth }) => {
                const isSearchMatch =
                  node.kind === "person"
                    ? matchedEmployeeIds.has(node.employee?.id ?? -1)
                    : Boolean(
                        search.trim() &&
                          [node.title, node.eyebrow]
                            .join(" ")
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      );
                const isCollapsed = collapsed.has(node.key);
                return (
                  <div
                    key={node.key}
                    className="absolute"
                    style={{
                      left: x,
                      top: y,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (node.employee) {
                          setSelectedUnitId(null);
                          setSelectedPersonId(node.employee.id);
                        }
                        if (node.unit) {
                          setSelectedPersonId(null);
                          setSelectedUnitId(node.unit.id);
                        }
                      }}
                      className={cn(
                        "relative h-full w-full overflow-hidden rounded-[1.3rem] border border-white/20 bg-gradient-to-br p-4 text-left shadow-[0_18px_34px_-17px_rgba(3,20,29,.75)] outline-none transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_42px_-17px_rgba(3,20,29,.85)] focus-visible:ring-4 focus-visible:ring-amber-300 focus-visible:ring-offset-2",
                        nodePalette(depth, node.kind),
                        isSearchMatch &&
                          search.trim() &&
                          "ring-4 ring-amber-300 ring-offset-2",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-white/5"
                      />
                      <span className="relative flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-black tracking-wide text-slate-950 shadow-lg">
                          {node.kind === "person"
                            ? initials(node.title)
                            : node.eyebrow.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-black uppercase tracking-[0.13em] text-cyan-50">
                            {node.eyebrow}
                          </span>
                          <span className="mt-1 block truncate text-base font-black text-white">
                            {node.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-100">
                            {node.subtitle}
                          </span>
                        </span>
                      </span>
                      <span className="relative mt-3 flex items-center gap-2">
                        <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                          {node.kind === "person"
                            ? `${node.peopleCount} direct`
                            : `${node.peopleCount} people`}
                        </span>
                        {node.kind === "person" ? (
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide",
                              statusStyle(
                                node.employee?.employment_status ?? "unknown",
                              ),
                            )}
                          >
                            {node.employee?.employment_status.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                            {node.vacancyCount} open seats
                          </span>
                        )}
                      </span>
                    </button>
                    {node.children.length > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute left-1/2 top-full h-3 -translate-x-1/2 border-l-2 border-[#496b76] dark:border-[#a5c7cc]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((current) => {
                              const next = new Set(current);
                              if (next.has(node.key)) next.delete(node.key);
                              else next.add(node.key);
                              return next;
                            })
                          }
                          aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.title}'s ${node.kind === "person" ? "direct reports" : "child departments"}`}
                          className="absolute left-1/2 top-[calc(100%+0.75rem)] z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#071b24] text-white shadow-lg outline-none hover:bg-teal-800 focus-visible:ring-4 focus-visible:ring-amber-300"
                        >
                          {isCollapsed ? (
                            <ChevronDown aria-hidden="true" className="h-5 w-5" />
                          ) : (
                            <ChevronUp aria-hidden="true" className="h-5 w-5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-end justify-between gap-3">
              <p className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-slate-800 shadow-lg backdrop-blur dark:border-slate-600 dark:bg-slate-950/90 dark:text-slate-100">
                <Move aria-hidden="true" className="mr-1 inline h-4 w-4" />
                Drag to move · Arrow keys to pan · Ctrl + scroll to zoom
              </p>
              <div className="flex flex-wrap gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-slate-800 shadow-lg backdrop-blur dark:border-slate-600 dark:bg-slate-950/90 dark:text-slate-100">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1e3a8a]" />
                  Executive
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
                  Leadership
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7a285d]" />
                  Teams
                </span>
              </div>
            </div>
          </div>
        </figure>

        <details className="border-t border-slate-300 px-5 py-4 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-black text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-white dark:focus-visible:ring-amber-300">
            How to read and use this organization map
          </summary>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3 dark:text-slate-200">
            <p>
              Curved lines connect each manager to direct reports, or each
              parent department to its child units. Card color changes by
              hierarchy depth.
            </p>
            <p>
              Select a card for full details. Use the small control beneath a
              card to hide or reveal its branch, or use Focus branch in a
              person’s details.
            </p>
            <p>
              Search keeps matching people and their managers visible. Export
              the current map as PNG or SVG, download the underlying people
              data, or print it to PDF.
            </p>
          </div>
        </details>
      </div>

      <Dialog
        open={Boolean(selectedPerson)}
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-500 p-0 sm:max-w-2xl dark:border-slate-600">
          {selectedPerson && (
            <>
              <DialogHeader className="relative overflow-hidden rounded-t-lg bg-[#071b24] p-6 pr-14 text-left text-white">
                <div
                  aria-hidden="true"
                  className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[28px] border-white/5"
                />
                <div className="relative flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-xl font-black text-slate-950 shadow-lg">
                    {initials(selectedPerson.primary_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-300">
                      {selectedPerson.employee_number}
                    </p>
                    <DialogTitle className="mt-1 text-2xl font-black text-white">
                      {selectedPerson.primary_name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-slate-200">
                      {selectedPerson.primary_assignment?.position?.title ??
                        "Position not assigned"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6 p-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    [
                      "Organization unit",
                      selectedPerson.primary_assignment?.organization_unit
                        ?.name ?? "Unassigned",
                      Building2,
                    ],
                    [
                      "Reports to",
                      selectedPerson.primary_assignment?.reports_to
                        ?.primary_name ?? "Top-level reporting line",
                      UserRound,
                    ],
                    ["Started", formatDate(selectedPerson.hired_on), CalendarDays],
                    [
                      "Work email",
                      selectedPerson.work_email ?? "Not provided",
                      Mail,
                    ],
                  ].map(([label, value, Icon]) => (
                    <div
                      key={String(label)}
                      className="grid grid-cols-[1.8rem_1fr] gap-2 rounded-xl border border-slate-300 p-3 dark:border-slate-700"
                    >
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 text-teal-800 dark:text-amber-300"
                      />
                      <div>
                        <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {String(label)}
                        </dt>
                        <dd className="mt-0.5 font-bold">{String(value)}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                <section aria-labelledby="team-footprint-heading">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 id="team-footprint-heading" className="font-black">
                        Team footprint
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {directReports.length} direct{" "}
                        {directReports.length === 1 ? "report" : "reports"} ·{" "}
                        {descendants.size} total descendants
                      </p>
                    </div>
                    {directReports.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFocusRootId(selectedPerson.id);
                          setCollapsed(new Set());
                          setPendingFocusKey(`person-${selectedPerson.id}`);
                          setSelectedPersonId(null);
                        }}
                        className="min-h-11 border-slate-500"
                      >
                        <Focus aria-hidden="true" />
                        Focus branch
                      </Button>
                    )}
                  </div>
                  {directReports.length > 0 && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {directReports.map((employee) => (
                        <li key={employee.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPersonId(employee.id)}
                            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-left text-sm font-bold outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-700 dark:hover:bg-slate-900 dark:focus-visible:ring-amber-300"
                          >
                            {employee.primary_name}
                            <span className="block truncate text-xs font-normal text-slate-600 dark:text-slate-300">
                              {employee.primary_assignment?.position?.title ??
                                "Position not assigned"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {canManage && selectedPerson.primary_assignment && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      managerMutation.mutate();
                    }}
                    className="space-y-3 rounded-2xl border border-teal-700 bg-teal-50 p-4 dark:border-amber-300 dark:bg-slate-900"
                  >
                    <div>
                      <Label htmlFor="organigram-manager">
                        Change direct manager
                      </Label>
                      <select
                        id="organigram-manager"
                        value={managerId}
                        onChange={(event) => setManagerId(event.target.value)}
                        aria-describedby="organigram-manager-help"
                        className={cn(selectClass, "mt-2")}
                      >
                        <option value="">No manager / top level</option>
                        {employees
                          .filter(
                            (employee) =>
                              employee.id !== selectedPerson.id &&
                              !descendants.has(employee.id),
                          )
                          .map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.primary_name} —{" "}
                              {employee.primary_assignment?.position?.title ??
                                "Unassigned"}
                            </option>
                          ))}
                      </select>
                      <p
                        id="organigram-manager-help"
                        className="mt-2 text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200"
                      >
                        Descendants are excluded to prevent reporting loops. The
                        server validates the hierarchy again before saving.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={managerMutation.isPending}
                      className="min-h-11 bg-teal-800 text-white hover:bg-teal-700"
                    >
                      <Network aria-hidden="true" />
                      {managerMutation.isPending
                        ? "Saving reporting line…"
                        : "Save reporting line"}
                    </Button>
                  </form>
                )}
              </div>
              <DialogFooter className="border-t border-slate-300 p-5 dark:border-slate-700">
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedPersonId(null);
                      onEditEmployee(selectedPerson);
                    }}
                    className="min-h-11 border-slate-500"
                  >
                    <Pencil aria-hidden="true" />
                    Edit employee record
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedUnit)}
        onOpenChange={(open) => {
          if (!open) setSelectedUnitId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-500 p-0 sm:max-w-2xl dark:border-slate-600">
          {selectedUnit && (
            <>
              <DialogHeader className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-[#172554] via-[#17465b] to-[#0f766e] p-6 pr-14 text-left text-white">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                    <Building2 aria-hidden="true" className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-300">
                      {selectedUnit.unit_type} · {selectedUnit.code}
                    </p>
                    <DialogTitle className="mt-1 text-2xl font-black text-white">
                      {selectedUnit.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-slate-200">
                      Department capacity, leadership, contact information, and
                      assigned team.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6 p-6">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["People", selectedUnitPeople.length],
                    ["Positions", selectedUnitPositions.length],
                    ["Open seats", selectedUnitVacancies],
                    [
                      "Child units",
                      units.filter((unit) => unit.parent_id === selectedUnit.id)
                        .length,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-slate-300 p-3 dark:border-slate-700"
                    >
                      <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {label}
                      </dt>
                      <dd className="mt-1 text-2xl font-black tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      "Location",
                      selectedUnit.location ?? "Not recorded",
                      MapPin,
                    ],
                    [
                      "Email",
                      selectedUnit.email ?? "Not recorded",
                      Mail,
                    ],
                  ].map(([label, value, Icon]) => (
                    <div
                      key={String(label)}
                      className="grid grid-cols-[1.6rem_1fr] gap-2"
                    >
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 text-teal-800 dark:text-amber-300"
                      />
                      <div>
                        <dt className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {String(label)}
                        </dt>
                        <dd className="font-semibold">{String(value)}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
                <section aria-labelledby="unit-team-heading">
                  <h3 id="unit-team-heading" className="font-black">
                    Assigned team
                  </h3>
                  {selectedUnitPeople.length ? (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedUnitPeople.map((employee) => (
                        <li key={employee.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUnitId(null);
                              setSelectedPersonId(employee.id);
                            }}
                            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-300 p-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-700 dark:hover:bg-slate-900 dark:focus-visible:ring-amber-300"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-white">
                              {initials(employee.primary_name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {employee.primary_name}
                              </span>
                              <span className="block truncate text-xs text-slate-600 dark:text-slate-300">
                                {employee.primary_assignment?.position?.title ??
                                  "Position not assigned"}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      No employees are currently assigned to this unit.
                    </p>
                  )}
                </section>
              </div>
              <DialogFooter className="border-t border-slate-300 p-5 dark:border-slate-700">
                <Button
                  type="button"
                  onClick={() => {
                    setUnitId(String(selectedUnit.id));
                    setSelectedUnitId(null);
                  }}
                  className="min-h-11 bg-teal-800 text-white hover:bg-teal-700"
                >
                  <Focus aria-hidden="true" />
                  Focus this department
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <aside className="grid gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex gap-3">
          <BriefcaseBusiness
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-teal-800 dark:text-amber-300"
          />
          <p>
            <strong className="block">Capacity planning</strong>
            Compare occupied teams with authorized positions and open seats.
          </p>
        </div>
        <div className="flex gap-3">
          <Network
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-teal-800 dark:text-amber-300"
          />
          <p>
            <strong className="block">Safe reporting changes</strong>
            Invalid manager cycles are blocked in the interface and API.
          </p>
        </div>
        <div className="flex gap-3">
          <Maximize2
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-teal-800 dark:text-amber-300"
          />
          <p>
            <strong className="block">Presentation ready</strong>
            Use full screen for review meetings or export a high-resolution map.
          </p>
        </div>
      </aside>
    </section>
  );
}
