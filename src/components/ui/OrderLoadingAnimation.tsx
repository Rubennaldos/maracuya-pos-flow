import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Monitor, Heart, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderLoadingAnimationProps {
  open: boolean;
  onComplete: () => void;
}

export const OrderLoadingAnimation: React.FC<OrderLoadingAnimationProps> = ({
  open,
  onComplete,
}) => {
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none">
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg">
          <div className="relative flex items-center justify-center w-full h-32 overflow-hidden">
            {/* Computer Icon */}
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <Monitor 
                className={cn(
                  "h-8 w-8 text-blue-500 transition-all duration-500",
                  "animate-pulse"
                )} 
              />
            </div>

            {/* Heart Animation */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Heart 
                className={cn(
                  "h-6 w-6 text-red-500 transition-all duration-1000",
                  "animate-[bounce_0.6s_ease-in-out_infinite] fill-current"
                )} 
              />
              
              {/* Heart trail effect */}
              <div className="absolute inset-0 animate-ping">
                <Heart className="h-6 w-6 text-red-300 opacity-30 fill-current" />
              </div>
            </div>

            {/* Lunchbox Icon */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <UtensilsCrossed 
                className={cn(
                  "h-8 w-8 text-orange-500 transition-all duration-500",
                  "animate-[wiggle_0.5s_ease-in-out_infinite]"
                )} 
              />
            </div>

            {/* Connection line animation */}
            <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-gradient-to-r from-blue-500 via-red-500 to-orange-500 transform -translate-y-1/2">
              <div className="absolute inset-0 bg-white animate-[slide-right_2s_ease-in-out_infinite] opacity-50"></div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Enviando tu pedido...
            </h3>
            <p className="text-sm text-gray-600">
              Preparando el mensaje de WhatsApp
            </p>
            
            {/* Loading dots */}
            <div className="flex justify-center mt-4 space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_0ms]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_200ms]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_infinite_400ms]"></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};