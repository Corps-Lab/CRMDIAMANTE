export interface RdoEntry {
  id: string;
  projectId: string;
  data: string; // ISO date
  clima: string;
  equipe: string;
  horasTrabalhadas: number;
  atividades: string;
  impedimentos?: string | null;
  observacoes?: string | null;
  fotos?: string[]; // URLs ou data URLs
  createdAt: Date;
}

export type RdoFormData = Omit<RdoEntry, "id" | "createdAt" | "fotos"> & { fotos?: FileList | null };
export type RdoProgressFn = (done: number, total: number) => void;
