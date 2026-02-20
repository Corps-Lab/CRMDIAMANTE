import { useAgency } from "@/contexts/AgencyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgencySwitcherProps {
  className?: string;
  hideBadge?: boolean;
}

export function AgencySwitcher({ className, hideBadge }: AgencySwitcherProps) {
  const { agencies, currentAgency, switchAgency, isIsolated } = useAgency();

  return (
    <div className={cn("space-y-1", className)}>
      {!hideBadge && (
        <Badge variant="outline" className="text-xs">
          Ambiente: {isIsolated ? "Mock Local" : "Online"}
        </Badge>
      )}
      <Select value={currentAgency.id} onValueChange={switchAgency}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Selecione a agência" />
        </SelectTrigger>
        <SelectContent>
          {agencies.map((agency) => (
            <SelectItem key={agency.id} value={agency.id}>
              {agency.name} {agency.mode === "isolated" ? "(mock)" : "(online)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground leading-snug">
        {currentAgency.description}
      </p>
    </div>
  );
}
