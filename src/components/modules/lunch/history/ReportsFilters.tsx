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
import { Calendar, Filter, RefreshCw } from "lucide-react";
import type { OrderFilter } from "./types";

interface ReportsFiltersProps {
  filter: OrderFilter;
  onFilterChange: (filter: OrderFilter) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;
}

export default function ReportsFilters({
  filter,
  onFilterChange,
  onApplyFilter,
  onResetFilter,
}: ReportsFiltersProps) {
  const handleQuick = (days: number) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - days + 1);

    onFilterChange({
      ...filter,
      dateFrom: from.toISOString().split("T")[0],
      dateTo: today.toISOString().split("T")[0],
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-medium">Filtros de reportes</h3>
          </div>

          {/* Atajos rápidos */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuick(1)}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuick(7)}>
              Últimos 7 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuick(30)}>
              Últimos 30 días
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const first = new Date(today.getFullYear(), today.getMonth(), 1);
                onFilterChange({
                  ...filter,
                  dateFrom: first.toISOString().split("T")[0],
                  dateTo: today.toISOString().split("T")[0],
                });
              }}
            >
              Este mes
            </Button>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Fecha desde</Label>
              <Input
                type="date"
                value={filter.dateFrom ?? ""}
                onChange={(e) =>
                  onFilterChange({ ...filter, dateFrom: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Fecha hasta</Label>
              <Input
                type="date"
                value={filter.dateTo ?? ""}
                onChange={(e) =>
                  onFilterChange({ ...filter, dateTo: e.target.value })
                }
              />
            </div>
          </div>

          {/* Cliente / Estado / Agrupar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Cliente</Label>
              <Input
                placeholder="Nombre del cliente…"
                value={filter.clientName ?? ""}
                onChange={(e) =>
                  onFilterChange({ ...filter, clientName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={filter.status ?? "all"}
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
            <div>
              <Label>Agrupar por</Label>
              <Select
                value={filter.groupBy ?? "day"}
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
            <Button variant="outline" onClick={onResetFilter}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
