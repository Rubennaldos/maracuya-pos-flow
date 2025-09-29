import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, RefreshCw, Calendar } from "lucide-react";
import type { OrderFilter } from "./types";

/**
 * HISTORIAL (ADMIN LUNCH)
 * - Sin rango de fechas aquí (eso queda para Reportes).
 * - Solo se muestran días que tienen pedidos (chips).
 * - La búsqueda por nombre aplica al día seleccionado.
 */

interface OrderFiltersProps {
  filter: OrderFilter;
  onFilterChange: (filter: OrderFilter) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;

  /** Días disponibles con pedidos (YYYY-MM-DD), ordenados desc (más reciente primero). */
  availableDays?: string[];
}

/* ---------- helpers ---------- */

function formatDayForUI(yyyy_mm_dd: string) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-").map((v) => parseInt(v, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return yyyy_mm_dd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function norm(s: string = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* ---------- component ---------- */

export default function OrderFilters({
  filter,
  onFilterChange,
  onApplyFilter,
  onResetFilter,
  availableDays = [],
}: OrderFiltersProps) {
  // Si no hay día seleccionado, usar el más reciente (primer elemento)
  React.useEffect(() => {
    if (!filter.day && availableDays.length > 0) {
      onFilterChange({ ...filter, day: availableDays[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDays]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-medium">Filtros del historial</h3>
          </div>

          {/* DÍAS DISPONIBLES (chips) */}
          <div className="flex flex-wrap gap-2">
            {availableDays.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No hay días con pedidos.
              </span>
            ) : (
              availableDays.map((day) => (
                <Button
                  key={day}
                  type="button"
                  variant={filter.day === day ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFilterChange({ ...filter, day })}
                  title={day}
                >
                  {formatDayForUI(day)}
                </Button>
              ))
            )}
          </div>

          {/* Búsqueda por nombre (dentro del día seleccionado) + Estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Cliente (alumno/apoderado)</Label>
              <Input
                placeholder="Buscar por nombre dentro del día seleccionado…"
                value={filter.clientName || ""}
                onChange={(e) =>
                  onFilterChange({ ...filter, clientName: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Estado</Label>
              <Select
                value={filter.status || "all"}
                onValueChange={(value) =>
                  onFilterChange({
                    ...filter,
                    status:
                      value === "all"
                        ? undefined
                        : (value as OrderFilter["status"]),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="ready">Listo</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agrupar por (compatibilidad) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Agrupar por</Label>
              <Select
                value={filter.groupBy || "day"}
                onValueChange={(value: "day" | "week" | "month") =>
                  onFilterChange({ ...filter, groupBy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <Button onClick={onApplyFilter}>
              <Calendar className="h-4 w-4 mr-2" />
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onResetFilter();
                onFilterChange({
                  day: null,
                  clientName: "",
                  status: undefined,
                  groupBy: "day",
                } as OrderFilter);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>

          {/* Nota: dateFrom/dateTo son legacy y se ignoran en HISTORIAL. */}
        </div>
      </CardContent>
    </Card>
  );
}
