import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type CommerceEvent = {
  id: number;
  name: string;
  eventDate: Date | string;
  canceledAt?: Date | string | null;
};

function money(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ArtistCommercePanel({ events }: { events: CommerceEvent[] }) {
  const utils = trpc.useUtils();
  const [item, setItem] = useState({ name: "", description: "", price: "", stock: "", externalUrl: "", imageUrl: "" });
  const [ticket, setTicket] = useState({ eventId: "", name: "", price: "", quantityAvailable: "", pixKey: "" });
  const items = trpc.scene.myMerchandise.useQuery(undefined, { staleTime: 15_000 });
  const createItem = trpc.scene.createMerchandise.useMutation({
    onSuccess: async () => {
      await items.refetch();
      setItem({ name: "", description: "", price: "", stock: "", externalUrl: "", imageUrl: "" });
      toast.success("Produto cadastrado no catálogo do artista.");
    },
    onError: error => toast.error(error.message),
  });
  const createTicket = trpc.scene.createEventTicket.useMutation({
    onSuccess: async () => {
      await utils.scene.eventTickets.invalidate();
      setTicket({ eventId: "", name: "", price: "", quantityAvailable: "", pixKey: "" });
      toast.success("Lote criado. O ingresso ainda é vendido fora da CENA.");
    },
    onError: error => toast.error(error.message),
  });
  const activeEvents = events.filter(event => !event.canceledAt);

  return <section className="content-section commerce-panel" aria-labelledby="commerce-title">
    <div className="section-title"><div><span className="eyebrow coral">apoio direto</span><h2 id="commerce-title">Ingressos e produtos.</h2></div></div>
    <p className="commerce-disclaimer">A CENA divulga seus lotes e sua vitrine, mas não processa pagamentos nem confirma pedidos. A venda acontece diretamente com você ou pelo link externo.</p>
    <div className="commerce-grid">
      <form className="composer-card commerce-form" onSubmit={event => {
        event.preventDefault();
        createItem.mutate({ name: item.name.trim(), description: item.description.trim() || undefined, price: Number(item.price), stock: Number(item.stock), externalUrl: item.externalUrl.trim() || undefined, imageUrl: item.imageUrl.trim() || undefined });
      }}>
        <div className="composer-heading"><div><span className="eyebrow lime">vitrine do artista</span><h3>Cadastrar merchandise</h3></div></div>
        <div className="form-grid">
          <label>Produto<input required minLength={2} maxLength={160} value={item.name} onChange={event => setItem({ ...item, name: event.target.value })} placeholder="Camiseta, fita, zine…" /></label>
          <label>Preço (R$)<input required type="number" min="0" max="999999.99" step="0.01" value={item.price} onChange={event => setItem({ ...item, price: event.target.value })} /></label>
          <label>Unidades disponíveis<input required type="number" min="0" max="100000" step="1" value={item.stock} onChange={event => setItem({ ...item, stock: event.target.value })} /></label>
          <label>Link externo para comprar<input type="url" value={item.externalUrl} onChange={event => setItem({ ...item, externalUrl: event.target.value })} placeholder="https://…" /></label>
          <label>Imagem do produto (URL)<input type="url" value={item.imageUrl} onChange={event => setItem({ ...item, imageUrl: event.target.value })} placeholder="https://… (opcional)" /></label>
        </div>
        <label>Descrição<textarea maxLength={1000} value={item.description} onChange={event => setItem({ ...item, description: event.target.value })} placeholder="Detalhes, tamanhos ou forma de retirada" /></label>
        <button className="primary-button" type="submit" disabled={createItem.isPending}>{createItem.isPending ? "Salvando…" : "Publicar produto"}</button>
      </form>
      <form className="composer-card commerce-form" onSubmit={event => {
        event.preventDefault();
        createTicket.mutate({ eventId: Number(ticket.eventId), name: ticket.name.trim(), price: Number(ticket.price), quantityAvailable: Number(ticket.quantityAvailable), pixKey: ticket.pixKey.trim() || undefined });
      }}>
        <div className="composer-heading"><div><span className="eyebrow lavender">agenda</span><h3>Criar lote de ingresso</h3></div></div>
        <div className="form-grid">
          <label>Evento<select required value={ticket.eventId} onChange={event => setTicket({ ...ticket, eventId: event.target.value })}><option value="">Selecione um evento</option>{activeEvents.map(event => <option key={event.id} value={event.id}>{event.name} · {new Date(event.eventDate).toLocaleDateString("pt-BR")}</option>)}</select></label>
          <label>Nome do lote<input required minLength={2} maxLength={100} value={ticket.name} onChange={event => setTicket({ ...ticket, name: event.target.value })} placeholder="1º lote, meia, contribuição…" /></label>
          <label>Preço (R$)<input required type="number" min="0" max="999999.99" step="0.01" value={ticket.price} onChange={event => setTicket({ ...ticket, price: event.target.value })} /></label>
          <label>Quantidade<input required type="number" min="0" max="100000" step="1" value={ticket.quantityAvailable} onChange={event => setTicket({ ...ticket, quantityAvailable: event.target.value })} /></label>
          <label>Chave Pix pública para interessados (opcional)<input maxLength={255} value={ticket.pixKey} onChange={event => setTicket({ ...ticket, pixKey: event.target.value })} placeholder="Será exibida publicamente" /></label>
        </div>
        <button className="primary-button" type="submit" disabled={!activeEvents.length || createTicket.isPending}>{createTicket.isPending ? "Salvando…" : "Publicar lote"}</button>
        {!activeEvents.length && <small>Crie um evento na agenda antes de cadastrar um lote.</small>}
      </form>
    </div>
    <div className="content-section"><h3>Produtos cadastrados</h3>{items.isLoading ? <p role="status">Carregando catálogo…</p> : items.error ? <div className="empty-card" role="alert"><strong>Não foi possível carregar os produtos.</strong><span>O catálogo pode estar temporariamente indisponível.</span><button className="text-button" type="button" onClick={() => void items.refetch()}>Tentar novamente</button></div> : items.data?.length ? <div className="activity-list">{items.data.map(product => <div className="activity-item" key={product.id}><div><strong>{product.name}</strong><span>{money(product.price)} · {product.stock} em estoque{product.isAvailable ? " · disponível" : " · indisponível"}</span></div>{product.externalUrl && <a className="text-button" href={product.externalUrl} target="_blank" rel="noreferrer">Abrir link</a>}</div>)}</div> : <p role="status">A vitrine ainda está vazia.</p>}</div>
  </section>;
}
