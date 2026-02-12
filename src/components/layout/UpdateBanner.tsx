import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const STORAGE_KEY = "clabs_app_version";

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const current = __APP_VERSION__;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== current) {
      setShow(true);
    }
    // always store current version
    localStorage.setItem(STORAGE_KEY, current);
  }, []);

  if (!show) return null;

  const reload = () => {
    setShow(false);
    window.location.reload();
  };

  return (
    <div className="mx-4 md:mx-6 mb-3">
      <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
        <RefreshCw className="w-4 h-4 text-primary" />
        <div className="flex-1 text-sm text-foreground">
          Nova atualização disponível.
        </div>
        <Button size="sm" className="h-8 px-3" onClick={reload}>
          Atualizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-xs text-muted-foreground"
          onClick={() => setShow(false)}
        >
          Fechar
        </Button>
      </div>
    </div>
  );
}
