import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Si prefieres mostrar tu NotFound, déjalo; si no, redirige al home */}
        <Route path="*" element={<NotFound />} />
        {/* o usa esto para redirigir todo al home:
            <Route path="*" element={<Navigate to="/" replace />} />
        */}
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
