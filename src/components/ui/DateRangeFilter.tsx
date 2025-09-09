import * as React from "react";
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth, subDays, startOfWeek, endOfWeek } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Props = {
  value?: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
};

function formatRangeLabel(range?: DateRange) {
  if (!range?.from && !range?.to) return "Fecha";
  const f = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (range.from && range.to) return `${f(range.from)} – ${f(range.to)}`;
  if (range.from) return f(range.from);
  if (range.to) return f(range.to);
  return "Fecha";
}

export function DateRangeFilter({ value, onChange, className }: Props) {
  const [open, setOpen] = React.useState(false);

  // presets
  const now = new Date();
  const presets = [
    {
      label: "Hoy",
      get: () => ({ from: startOfDay(now), to: endOfDay(now) } as DateRange),
    },
    {
      label: "Ayer",
      get: () => {
        const y = subDays(now, 1);
        return { from: startOfDay(y), to: endOfDay(y) } as DateRange;
      },
    },
    {
      label: "Esta semana",
      get: () => ({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }),
    },
    {
      label: "Este mes",
      get: () => ({ from: startOfMonth(now), to: endOfMonth(now) }),
    },
    {
      label: "Últimos 7 días",
      get: () => ({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) }),
    },
    {
      label: "Últimos 30 días",
      get: () => ({ from: startOfDay(subDays(now, 29)), to: endOfDay(now) }),
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatRangeLabel(value)}
        </Button>
      </PopoverTrigger>

      {/* z-index alto y portal para evitar superposición */}
      <PopoverContent className="z-[80] w-auto p-0" align="start" side="bottom">
        <div className="flex flex-col md:flex-row">
          <div className="p-3 border-r">
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onChange(p.get());
                    setOpen(false);
                  }}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={value}
              onSelect={(range) => onChange(range)}
              initialFocus
            />
            <div className="flex justify-end gap-2 p-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
              <Button
                size="sm"
                onClick={() => setOpen(false)}
                disabled={!value?.from && !value?.to}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
