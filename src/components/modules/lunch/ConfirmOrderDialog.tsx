import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderT, Recess } from "./types";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cartItems: OrderT["items"];      // items del carrito
  defaultStudent?: string;         // si ya conoces el alumno
  onConfirm: (data: { recess: Recess; note?: string; studentName?: string }) => void;
};

export default function ConfirmOrderDialog({ open, onOpenChange, cartItems, defaultStudent, onConfirm }: Props) {
  const [recess, setRecess] = useState<Recess>("segundo");
  const [note, setNote] = useState("");
  const [studentName, setStudentName] = useState(defaultStudent || "");

  const hasLunchCombo = useMemo(() => cartItems.some(i => i.isCombo), [cartItems]);

  const submit = () => {
    // regla: si hay combo/almuerzo → NO se permite primer recreo
    if (hasLunchCombo && recess === "primero") {
      toast({ title: "El almuerzo no puede entregarse en el 1er recreo", variant: "destructive" });
      return;
    }
    if (!studentName.trim()) {
      toast({ title: "Indica el nombre del alumno", variant: "destructive" });
      return;
    }
    onConfirm({ recess, note: note.trim() || undefined, studentName: studentName.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar pedido</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Alumno</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nombre y apellido" />
          </div>

          <div>
            <Label>Recreo</Label>
            <select
              className="border rounded h-9 px-2 w-full"
              value={recess}
              onChange={(e) => setRecess(e.target.value as Recess)}
            >
              <option value="primero" disabled={hasLunchCombo}>Primer recreo {hasLunchCombo ? " (no disponible para almuerzo)" : ""}</option>
              <option value="segundo">Segundo recreo</option>
            </select>
          </div>

          <div>
            <Label>Observación</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional (sin sal, sin ají…)" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
