import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Variantes de card:
 * - default: igual al anterior
 * - elevated: sombra media + fondo blanco
 * - glass: fondo translúcido (para overlays)
 * - pressable: hover con leve elevación
 *
 * Padding:
 * - default (p-6)
 * - compact (p-4) → recomendado en móvil
 */
const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "",
        elevated: "shadow-medium bg-white",
        glass:
          "backdrop-blur-md bg-white/70 border-white/60 shadow-soft dark:bg-zinc-900/50",
        pressable:
          "transition-all hover:shadow-md hover:-translate-y-[1px] will-change-transform",
      },
      padding: {
        default: "",
        compact: "",
      },
      radius: {
        md: "rounded-lg",
        xl: "rounded-xl",
        "2xl": "rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      radius: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, radius, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, radius }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

/* Subcomponentes con control de padding */
const headerVariants = cva("flex flex-col space-y-1.5 p-6", {
  variants: { padding: { default: "p-6", compact: "p-4" } },
  defaultVariants: { padding: "default" },
});
export interface CardSectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof headerVariants> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding, ...props }, ref) => (
    <div ref={ref} className={cn(headerVariants({ padding }), className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const contentVariants = cva("p-6 pt-0", {
  variants: { padding: { default: "p-6 pt-0", compact: "p-4 pt-0" } },
  defaultVariants: { padding: "default" },
});
const CardContent = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding, ...props }, ref) => (
    <div ref={ref} className={cn(contentVariants({ padding }), className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const footerVariants = cva("flex items-center p-6 pt-0", {
  variants: { padding: { default: "p-6 pt-0", compact: "p-4 pt-0" } },
  defaultVariants: { padding: "default" },
});
const CardFooter = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding, ...props }, ref) => (
    <div ref={ref} className={cn(footerVariants({ padding }), className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
