import { Leaf } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full blur-sm opacity-50"></div>
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center relative`}>
          <Leaf className="w-1/2 h-1/2 text-white" />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <h1 className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent`}>
            Maracuyá
          </h1>
          <p className="text-xs text-muted-foreground font-medium">Villa Gratia</p>
        </div>
      )}
    </div>
  );
};