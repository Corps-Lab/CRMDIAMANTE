import { createContext, useContext, useState, ReactNode } from "react";
import { Contract } from "@/types/contract";
import { ContractSchemaType } from "@/lib/contract-validations";
import { useClients } from "./ClientContext";
import { safeId } from "@/lib/safeId";

interface ContractContextType {
  contracts: Contract[];
  addContract: (data: ContractSchemaType) => void;
  removeContract: (id: string) => void;
  updateContract: (id: string, data: Partial<ContractSchemaType>) => void;
  getContractsByClient: (clientId: string) => Contract[];
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const { clients } = useClients();

  const addContract = (data: ContractSchemaType) => {
    const client = clients.find((c) => c.id === data.clientId);
    const newContract: Contract = {
      id: safeId("contract"),
      clientId: data.clientId,
      clientName: client?.razaoSocial || "Cliente não encontrado",
      titulo: data.titulo,
      valorContrato: data.valorContrato,
      recorrencia: data.recorrencia,
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
      status: data.status,
      conteudo: data.conteudo,
      createdAt: new Date(),
    };
    setContracts((prev) => [...prev, newContract]);
  };

  const removeContract = (id: string) => {
    setContracts((prev) => prev.filter((contract) => contract.id !== id));
  };

  const updateContract = (id: string, data: Partial<ContractSchemaType>) => {
    setContracts((prev) =>
      prev.map((contract) => {
        if (contract.id === id) {
          const client = data.clientId 
            ? clients.find((c) => c.id === data.clientId) 
            : null;
          return {
            ...contract,
            ...data,
            clientName: client?.razaoSocial || contract.clientName,
          };
        }
        return contract;
      })
    );
  };

  const getContractsByClient = (clientId: string) => {
    return contracts.filter((contract) => contract.clientId === clientId);
  };

  return (
    <ContractContext.Provider
      value={{ contracts, addContract, removeContract, updateContract, getContractsByClient }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export function useContracts() {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContracts must be used within a ContractProvider");
  }
  return context;
}
