import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Nota:
 * - Conserva TODAS las variantes originales.
 * - Agrega variantes: "pill", "chip", "fab" (sin posicionamiento; eso lo das fuera).
 * - Agrega tamaños: "xs", "chip", "icon-sm", "icon-lg", "fab".
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ——— existentes
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-soft",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground hover:bg-success/90 shadow-soft",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 shadow-soft",
        pos: "bg-gradient-to-r from-primary to-primary-light text-primary-foreground hover:from-primary-dark hover:to-primary shadow-medium font-semibold",
        "pos-secondary":
          "bg-gradient-to-r from-secondary to-secondary-light text-secondary-foreground hover:from-secondary-dark hover:to-secondary shadow-medium font-semibold",

        // ——— nuevas
        /** Botón redondeado tipo “pastilla” */
        pill:
          "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft",
        /** Chip seleccionable/accionable (ideal para filtros o agregados) */
        chip:
          "rounded-full border bg-white text-foreground hover:bg-muted data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
        /** Floating Action Button (no incluye posicionamiento) */
        fab:
          "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-strong",
        /** Variante “soft” para superficies suaves */
        soft:
          "bg-primary/10 text-primary hover:bg-primary/15",
      },
      size: {
        // ——— existentes
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",

        // ——— nuevos tamaños BCP-optimized
        xs: "h-8 px-3 text-xs min-w-[2rem]",
        chip: "h-8 px-3 text-xs min-w-[2rem]",
        "icon-sm": "h-8 w-8 min-w-[2rem] min-h-[2rem]",
        "icon-lg": "h-12 w-12 min-w-[3rem] min-h-[3rem]",
        fab: "h-14 w-14 text-base min-w-[3.5rem] min-h-[3.5rem]",
      },
    },
    compoundVariants: [
      // Chips con tipografía más pequeña y padding compacto
      { variant: "chip", size: "default", className: "h-8 px-3 text-xs" },
      { variant: "chip", size: "sm", className: "h-8 px-3 text-xs" },
      { variant: "pill", size: "xs", className: "px-4" },
      { variant: "fab", size: "fab", className: "shadow-strong" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
