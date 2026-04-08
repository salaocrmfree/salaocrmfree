import { useState } from "react";
import { AppLayoutNew } from "@/components/layout/AppLayoutNew";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Clock, DollarSign, MoreHorizontal, Loader2, Upload } from "lucide-react";
import { useServices, Service, ServiceInput } from "@/hooks/useServices";
import { ServiceModal } from "@/components/modals/ServiceModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { ImportModal, ImportField } from "@/components/modals/ImportModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/dynamicSupabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Servicos() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { services, isLoading, createService, updateService, deleteService, isCreating, isUpdating, isDeleting } = useServices();
  const { isMaster, salonId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const serviceImportFields: ImportField[] = [
    { key: "name", label: "Nome", required: true },
    { key: "description", label: "Descrição" },
    { key: "duration_minutes", label: "Duração (minutos)", required: true },
    { key: "price", label: "Preço", required: true },
    { key: "category", label: "Categoria" },
    { key: "commission_percent", label: "Comissão (%)" },
  ];

  const handleImportServices = async (records: Record<string, any>[]) => {
    if (!salonId) throw new Error("Salão não encontrado");
    const rows = records.map(r => ({
      salon_id: salonId,
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      duration_minutes: parseInt(String(r.duration_minutes)) || 30,
      price: parseFloat(String(r.price).replace(",", ".")) || 0,
      category: r.category ? String(r.category) : null,
      commission_percent: r.commission_percent ? parseFloat(String(r.commission_percent).replace(",", ".")) : 0,
      is_active: true,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase.from("services").insert(batch);
      if (error) throw error;
    }

    queryClient.invalidateQueries({ queryKey: ["services"] });
    toast({ title: `${rows.length} serviços importados com sucesso!` });
  };

  const handleEdit = (service: Service) => { setSelectedService(service); setModalOpen(true); };
  const handleDelete = (service: Service) => { setSelectedService(service); setDeleteOpen(true); };

  const handleSubmit = (data: ServiceInput & { id?: string }) => {
    if (data.id) updateService(data as ServiceInput & { id: string });
    else createService(data);
  };

  const formatDuration = (min: number) => min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ""}` : `${min}min`;

  if (isLoading) {
    return <AppLayoutNew><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayoutNew>;
  }

  return (
    <AppLayoutNew>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Gerencie os serviços oferecidos pelo salão</p>
          <div className="flex items-center gap-2">
            {isMaster && (
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            )}
            <Button className="gap-2" onClick={() => { setSelectedService(null); setModalOpen(true); }}><Plus className="h-4 w-4" />Novo Serviço</Button>
          </div>
        </div>
        {services.length === 0 ? (
          <Card className="flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <p>Nenhum serviço cadastrado</p>
              <Button variant="link" onClick={() => { setSelectedService(null); setModalOpen(true); }}>Adicionar primeiro serviço</Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className={`hover:shadow-md transition-shadow ${!service.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      {service.category && <Badge variant="outline" className="mt-1">{service.category}</Badge>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(service)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(service)} className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" />{formatDuration(service.duration_minutes)}</div>
                    <div className="flex items-center gap-1 font-medium"><DollarSign className="h-4 w-4" />R$ {Number(service.price).toFixed(2)}</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Comissão: {Number(service.commission_percent) || 0}%</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <ServiceModal open={modalOpen} onOpenChange={setModalOpen} service={selectedService} onSubmit={handleSubmit} isLoading={isCreating || isUpdating} />
      <DeleteConfirmModal open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir Serviço" description={`Tem certeza que deseja excluir "${selectedService?.name}"?`} onConfirm={() => { if (selectedService) { deleteService(selectedService.id); setDeleteOpen(false); } }} isLoading={isDeleting} />
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar Serviços"
        description="Importe serviços de uma planilha XLS, XLSX ou CSV exportada de outro sistema."
        fields={serviceImportFields}
        onImport={handleImportServices}
      />
    </AppLayoutNew>
  );
}