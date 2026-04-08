import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Eye, Pencil, RotateCcw, Gift, AlertTriangle, ChevronDown, ChevronUp, FileText, Loader2 } from "lucide-react";
import { Caixa } from "@/hooks/useCaixas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/dynamicSupabaseClient";
import { useNavigate } from "react-router-dom";

interface CaixaCardProps {
  caixa: Caixa;
  userName?: string;
  label?: string;
  onClose?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onReopen?: () => void;
  onRecalculate?: () => void;
  showCloseButton?: boolean;
  showEditButton?: boolean;
  showReopenButton?: boolean;
  isRecalculating?: boolean;
}

export function CaixaCard({
  caixa,
  userName,
  label,
  onClose,
  onView,
  onEdit,
  onReopen,
  onRecalculate,
  showCloseButton = false,
  showEditButton = false,
  showReopenButton = false,
  isRecalculating = false,
}: CaixaCardProps) {
  const [showComandas, setShowComandas] = useState(false);
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Fetch linked comandas (lazy — only when expanded)
  const { data: linkedComandas, isLoading: loadingComandas } = useQuery({
    queryKey: ["caixa-comandas", caixa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comandas")
        .select("id, total, closed_at, created_at, client:clients(name), professional:professionals(name), payments(payment_method, amount)")
        .eq("caixa_id", caixa.id)
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: showComandas,
  });

  // Fetch credits and debts linked to comandas of this caixa
  const { data: caixaExtras } = useQuery({
    queryKey: ["caixa-extras", caixa.id],
    queryFn: async () => {
      // Get comanda IDs for this caixa
      const { data: comandas } = await supabase
        .from("comandas")
        .select("id")
        .eq("caixa_id", caixa.id);

      const comandaIds = comandas?.map(c => c.id) || [];
      if (comandaIds.length === 0) return { totalCredits: 0, totalDebts: 0 };

      const [creditsRes, debtsRes] = await Promise.all([
        supabase
          .from("client_credits")
          .select("credit_amount")
          .in("comanda_id", comandaIds),
        supabase
          .from("client_debts" as any)
          .select("debt_amount")
          .in("comanda_id", comandaIds),
      ]);

      const totalCredits = (creditsRes.data || []).reduce((sum: number, c: any) => sum + Number(c.credit_amount || 0), 0);
      const totalDebts = (debtsRes.data || []).reduce((sum: number, d: any) => sum + Number(d.debt_amount || 0), 0);

      return { totalCredits, totalDebts };
    },
  });

  const totalReceived = 
    (caixa.total_cash || 0) + 
    (caixa.total_pix || 0) + 
    (caixa.total_credit_card || 0) + 
    (caixa.total_debit_card || 0) + 
    (caixa.total_other || 0);

  const displayName = userName || caixa.profile?.full_name || "Usuário";
  const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const totalCredits = caixaExtras?.totalCredits || 0;
  const totalDebts = caixaExtras?.totalDebts || 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={caixa.profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              {label && <p className="text-xs font-semibold text-primary">{label}</p>}
              <h4 className="font-medium">{displayName}</h4>
              <p className="text-xs text-muted-foreground">
                Aberto: {format(new Date(caixa.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <Badge variant={caixa.closed_at ? "secondary" : "default"}>
            {caixa.closed_at ? "Fechado" : "Aberto"}
          </Badge>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Abertura:</span>
              <span>{formatCurrency(caixa.opening_balance || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dinheiro:</span>
              <span>{formatCurrency(caixa.total_cash || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PIX:</span>
              <span>{formatCurrency(caixa.total_pix || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Crédito:</span>
              <span>{formatCurrency(caixa.total_credit_card || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Débito:</span>
              <span>{formatCurrency(caixa.total_debit_card || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outros:</span>
              <span>{formatCurrency(caixa.total_other || 0)}</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between font-medium">
              <span>Total Recebido:</span>
              <span className="text-primary">{formatCurrency(totalReceived)}</span>
            </div>
          </div>

          {/* Credits and Debts */}
          {(totalCredits > 0 || totalDebts > 0) && (
            <div className="border-t pt-3 space-y-1.5">
              {totalCredits > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-green-600">
                    <Gift className="h-3.5 w-3.5" />
                    Créditos gerados:
                  </span>
                  <span className="text-green-600 font-medium">{formatCurrency(totalCredits)}</span>
                </div>
              )}
              {totalDebts > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Dívidas registradas:
                  </span>
                  <span className="text-destructive font-medium">{formatCurrency(totalDebts)}</span>
                </div>
              )}
            </div>
          )}

          {/* Comandas linked to this caixa */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowComandas(prev => !prev)}
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Comandas neste caixa</span>
              <span className="ml-auto">
                {showComandas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {showComandas && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {loadingComandas ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : !linkedComandas || linkedComandas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Nenhuma comanda vinculada.</p>
                ) : (
                  linkedComandas.map((cmd: any) => {
                    const paymentMethods = (cmd.payments || []).reduce((acc: Record<string, number>, p: any) => {
                      const label: Record<string, string> = {
                        cash: "Dinheiro", pix: "PIX", credit_card: "Crédito", debit_card: "Débito", other: "Outro",
                      };
                      const name = label[p.payment_method] || p.payment_method;
                      acc[name] = (acc[name] || 0) + Number(p.amount);
                      return acc;
                    }, {});

                    return (
                      <div key={cmd.id} className="bg-muted/50 rounded-md p-2.5 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            #{cmd.comanda_number ? String(cmd.comanda_number).padStart(4, "0") : cmd.id.slice(0, 4).toUpperCase()} — {(cmd.client as any)?.name || "Cliente avulso"}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-primary">{formatCurrency(cmd.total || 0)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Ver comanda"
                              onClick={() => navigate(`/comandas?comanda=${cmd.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Editar comanda"
                              onClick={() => navigate(`/comandas?comanda=${cmd.id}&edit=true`)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {(cmd.professional as any)?.name && (
                          <div className="text-muted-foreground">
                            Profissional: {(cmd.professional as any).name}
                          </div>
                        )}
                        {Object.keys(paymentMethods).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(paymentMethods).map(([method, amount]) => (
                              <Badge key={method} variant="outline" className="text-[10px] px-1.5 py-0">
                                {method}: {formatCurrency(amount as number)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {cmd.closed_at && (
                          <div className="text-muted-foreground">
                            Fechada: {format(new Date(cmd.closed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {caixa.closed_at && (
            <div className="border-t pt-3 text-sm text-muted-foreground">
              Fechado: {format(new Date(caixa.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {caixa.closing_balance !== null && (
                <div className="flex justify-between mt-1">
                  <span>Valor declarado:</span>
                  <span>{formatCurrency(caixa.closing_balance)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {(showCloseButton || onView || showEditButton || showReopenButton || onRecalculate) && (
          <div className="px-4 pb-4 flex gap-2 flex-wrap">
            {onRecalculate && (
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onRecalculate} disabled={isRecalculating}>
                {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {isRecalculating ? "Recalculando..." : "Recalcular"}
              </Button>
            )}
            {showReopenButton && onReopen && caixa.closed_at && (
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onReopen}>
                <RotateCcw className="h-4 w-4" />
                Reabrir
              </Button>
            )}
            {showEditButton && onEdit && (
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {onView && (
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onView}>
                <Eye className="h-4 w-4" />
                Ver Detalhes
              </Button>
            )}
            {showCloseButton && onClose && !caixa.closed_at && (
              <Button variant="destructive" size="sm" className="flex-1 gap-1" onClick={onClose}>
                <X className="h-4 w-4" />
                Fechar Caixa
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
