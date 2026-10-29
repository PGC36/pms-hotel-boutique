/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  DoorOpen,
  FileText,
  LoaderCircle,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Utensils,
  X,
} from 'lucide-react';
import type { OrderStatus, RoomServiceOrder } from '@/private/workspace/PrivateWorkspace';
import { catalogService } from '@/services/catalogService';
import { getUserFacingErrorMessage, HttpError } from '@/services/http-client';
import { inventoryService } from '@/services/inventoryService';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { Pagination } from '@/shared/components/Pagination';
import { PaginatedList } from '@/shared/components/PaginatedList';
import {
  fieldErrorProps,
  isWholeNumberInput,
  validateWholeNumber,
} from '@/shared/utils/formValidation';
import { paginateItems } from '@/shared/utils/pagination';

/** Motivos y observaciones de un pedido: límite del backend (notes, @Size(max = 1000)). */
const ORDER_NOTES_MAX_LENGTH = 1000;

const money = (n: number) =>
  `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusClass = (status: OrderStatus): string =>
  status === 'Pendiente'
    ? 'warning'
    : status === 'Aceptado' || status === 'En preparación'
      ? 'info'
      : status === 'Listo' || status === 'En camino'
        ? 'gold'
        : status === 'Entregado'
          ? 'success'
          : 'terracotta';

const orderTotal = (order: RoomServiceOrder) =>
  order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

type MenuItem = {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
};

const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  foodAndBeverage: 'Alimentos y bebidas',
  minibar: 'Minibar',
  shop: 'Tienda',
  other: 'Otros',
};

type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  status: 'Disponible' | 'Bajo' | 'Agotado';
};

const INVENTORY_UNIT_LABELS: Record<string, string> = {
  unit: 'piezas',
  box: 'cajas',
  bottle: 'botellas',
  kg: 'kg',
  liter: 'L',
  roll: 'rollos',
};

/**
 * Fija a propósito: es la taxonomía de tabs del menú (Desayunos/Almuerzos/
 * Cenas/Bebidas/Botanas), más fina que `ProductCategory` del contrato
 * (`minibar`|`shop`|`foodAndBeverage`|`other`). Ampliar el DTO de `product`
 * para cubrirla está bloqueado por D-005 (docs/DECISIONES.md) — no tocar
 * hasta que se decida la taxonomía de categorías en equipo.
 */
const menuCategories = ['Desayunos', 'Almuerzos', 'Cenas', 'Bebidas', 'Botanas'];

const inventoryStatusClass = (status: string) =>
  status === 'Disponible' ? 'success' : status === 'Bajo' ? 'warning' : 'terracotta';

// Menú e inventario se cargan por separado: el rol Room Service solo tiene
// room-service.read, y un 403 de /inventory/items no debe tumbar el menú.
type MenuState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; menu: MenuItem[] };

type InventoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; inventory: InventoryItem[] };

function getErrorMessage(cause: unknown): string {
  return getUserFacingErrorMessage(cause, 'No fue posible cargar el catálogo de cocina.');
}

export function RoomServiceContent({
  nav,
  orders,
  selectedOrder,
  onSelectOrder,
  onCloseOrder,
  onUpdateStatus,
  onUpdateNote,
  onReject,
  onCancel,
  onRefreshOrders,
  canWriteInventory,
  onAction,
  search,
  setSearch,
  filter,
  setFilter,
}: {
  nav: string;
  orders: RoomServiceOrder[];
  selectedOrder: RoomServiceOrder | null;
  onSelectOrder: (id: number) => void;
  onCloseOrder: () => void;
  onUpdateStatus: (id: number, status: OrderStatus) => void;
  onUpdateNote: (id: number, note: string) => void;
  onReject: (id: number, reason: string) => void;
  onCancel: (id: number, reason: string) => void;
  onRefreshOrders: () => Promise<void>;
  /** `inventory.write`: sin él no se ofrece "Registrar insumo" (el backend respondería 403). */
  canWriteInventory: boolean;
  onAction: (msg: string) => void;
  search: string;
  setSearch: (v: string) => void;
  filter: 'Todos' | OrderStatus;
  setFilter: (v: 'Todos' | OrderStatus) => void;
}) {
  const [rejectionOrderId, setRejectionOrderId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [menuState, setMenuState] = useState<MenuState>({ status: 'loading' });
  const [inventoryState, setInventoryState] = useState<InventoryState>({ status: 'idle' });
  const [menuPage, setMenuPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [inventoryQuantity, setInventoryQuantity] = useState('1');
  const [inventoryQuantityError, setInventoryQuantityError] = useState<string | undefined>();
  const [inventoryNotes, setInventoryNotes] = useState('');
  const [inventorySaving, setInventorySaving] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [refreshingMenu, setRefreshingMenu] = useState(false);

  const loadMenu = async () => {
    setMenuState({ status: 'loading' });
    try {
      const products = await catalogService.getProducts();
      const menu: MenuItem[] = products
        .filter((product) => product.category === 'foodAndBeverage')
        .map((product) => ({
          name: product.name,
          description: product.description ?? product.sku,
          price: Math.round(product.priceCents / 100),
          category: PRODUCT_CATEGORY_LABELS[product.category] ?? product.category,
          stock: product.stockQuantity,
        }));
      setMenuState({ status: 'ready', menu });
    } catch (cause) {
      setMenuState({ status: 'error', message: getErrorMessage(cause) });
    }
  };

  const loadInventory = async () => {
    setInventoryState({ status: 'loading' });
    try {
      const inventory: InventoryItem[] = (await inventoryService.getItems())
        .filter((item) => item.category === 'roomService')
        .map((item) => ({
          id: item.id,
          name: item.name,
          stock: item.currentQuantity,
          unit: INVENTORY_UNIT_LABELS[item.unit] ?? item.unit,
          status:
            item.currentQuantity === 0 ? 'Agotado' : item.isBelowMinimum ? 'Bajo' : 'Disponible',
        }));
      setInventoryState({ status: 'ready', inventory });
      if (inventory.length > 0) setInventoryItemId((current) => current || inventory[0].id);
    } catch (cause) {
      setInventoryState(
        cause instanceof HttpError && cause.status === 403
          ? { status: 'forbidden' }
          : { status: 'error', message: getErrorMessage(cause) },
      );
    }
  };

  useEffect(() => {
    void loadMenu();
  }, []);

  // El inventario solo se pide al entrar a su sección.
  useEffect(() => {
    if (nav === 'Inventario' && inventoryState.status === 'idle') void loadInventory();
  }, [nav, inventoryState.status]);

  useEffect(() => {
    setMenuPage(1);
    setInventoryPage(1);
  }, [nav]);

  const menuItems = menuState.status === 'ready' ? menuState.menu : [];
  const inventoryItems = inventoryState.status === 'ready' ? inventoryState.inventory : [];
  const pagedMenu = paginateItems(menuItems, menuPage);
  const pagedInventory = paginateItems(inventoryItems, inventoryPage);
  const selectedInventoryItem = inventoryItems.find((item) => item.id === inventoryItemId);

  const refreshMenu = async (message: string) => {
    if (refreshingMenu) return;
    setRefreshingMenu(true);
    try {
      await loadMenu();
      onAction(message);
    } finally {
      setRefreshingMenu(false);
    }
  };

  const refreshOrders = async () => {
    if (refreshingOrders) return;
    setRefreshingOrders(true);
    try {
      await onRefreshOrders();
    } finally {
      setRefreshingOrders(false);
    }
  };

  const registerInventoryMovement = async () => {
    if (inventorySaving) return;
    // Backend: cantidad entera > 0 (`CreateInventoryMovementRequest`, @Positive).
    const quantityError = validateWholeNumber(inventoryQuantity, {
      min: 1,
      requiredMessage: 'Ingresa la cantidad recibida.',
      minMessage: 'La cantidad debe ser mayor a 0.',
    });
    setInventoryQuantityError(quantityError ?? undefined);
    if (!inventoryItemId) {
      onAction('Selecciona un insumo.');
      return;
    }
    if (quantityError) return;
    const quantity = Number(inventoryQuantity);

    setInventorySaving(true);
    try {
      await inventoryService.createMovement({
        inventoryItemId,
        type: 'in',
        reason: 'restock',
        quantity,
        notes: inventoryNotes.trim(),
      });
      await loadInventory();
      setInventoryModalOpen(false);
      setInventoryQuantity('1');
      setInventoryNotes('');
      onAction('Insumo registrado en inventario');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible registrar el insumo');
    } finally {
      setInventorySaving(false);
    }
  };

  const activeOrders = orders.filter(
    (o) => !['Entregado', 'Rechazado', 'Cancelado'].includes(o.status),
  );
  const completedOrders = orders.filter((o) =>
    ['Entregado', 'Rechazado', 'Cancelado'].includes(o.status),
  );

  const nextAction = (order: RoomServiceOrder) => {
    switch (order.status) {
      case 'Pendiente':
        return (
          <>
            <button
              className="button small primary"
              onClick={() => onUpdateStatus(order.id, 'Aceptado')}
            >
              Aceptar pedido
            </button>
            <button
              className="button small secondary"
              onClick={() => setRejectionOrderId(order.id)}
            >
              Rechazar
            </button>
          </>
        );
      case 'Aceptado':
        return (
          <button
            className="button small primary"
            onClick={() => onUpdateStatus(order.id, 'En preparación')}
          >
            En preparación
          </button>
        );
      case 'En preparación':
        return (
          <button
            className="button small primary"
            onClick={() => onUpdateStatus(order.id, 'Listo')}
          >
            Marcar listo
          </button>
        );
      case 'Listo':
        return (
          <button
            className="button small primary"
            onClick={() => onUpdateStatus(order.id, 'En camino')}
          >
            En camino
          </button>
        );
      case 'En camino':
        return (
          <button
            className="button small primary"
            onClick={() => onUpdateStatus(order.id, 'Entregado')}
          >
            Entregado
          </button>
        );
      default:
        return null;
    }
  };

  const renderOrder = (order: RoomServiceOrder) => (
    <article className="rs-order-card" key={order.id}>
      <div className="rs-order-head">
        <div>
          <span className="rs-order-number">Pedido #{order.id}</span>
          <h3>
            Habitación {order.room} · {order.guest}
          </h3>
          <p>Recibido a las {order.time}</p>
        </div>
        <span className={`status-pill ${statusClass(order.status)}`}>{order.status}</span>
      </div>
      <div className="rs-order-items">
        {order.items.map((item, i) => (
          <div key={i}>
            <span>
              <strong>{item.quantity}×</strong> {item.name}
            </span>
            <span>{money(item.quantity * item.price)}</span>
          </div>
        ))}
      </div>
      <div className="rs-order-foot">
        <strong>{money(orderTotal(order))}</strong>
        {order.note && (
          <span className="rs-note">
            <ClipboardList size={13} /> {order.note}
          </span>
        )}
        {order.rejectionReason && (
          <span className="rs-note" style={{ background: '#f2d6cd', color: '#a9483c' }}>
            <Ban size={13} /> {order.rejectionReason}
          </span>
        )}
        {order.charged && (
          <span className="rs-charged">
            <Check size={13} /> Cargado a habitación
          </span>
        )}
        <div className="rs-order-actions">
          {nextAction(order)}
          {!['Entregado', 'Rechazado', 'Cancelado'].includes(order.status) && (
            <button className="button small secondary" onClick={() => setCancelOrderId(order.id)}>
              Cancelar
            </button>
          )}
          <button className="button small secondary" onClick={() => onSelectOrder(order.id)}>
            Ver detalle
          </button>
        </div>
      </div>
    </article>
  );

  const filteredActive = activeOrders.filter((order) => {
    const matchesSearch =
      `${order.id} ${order.room} ${order.guest} ${order.items.map((i) => i.name).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || order.status === filter;
    return matchesSearch && matchesFilter;
  });

  /* ---------- Pedidos activos ---------- */
  if (nav === 'Pedidos activos') {
    return (
      <>
        <div className="rs-layout">
          <div className="panel rs-view">
            <div className="panel-heading">
              <div>
                <h3>Pedidos activos</h3>
                <p>Gestiona cada pedido desde su recepción hasta la entrega</p>
              </div>
              <span className="rs-live">
                <i /> Actualizado ahora
              </span>
            </div>
            <div className="toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="Buscar pedidos"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pedido, habitación, huésped..."
                />
              </div>
              <div className="filter-dropdown">
                <button className="filter-button">
                  <span>{filter}</span>
                  <ChevronDown size={15} />
                </button>
                <div className="filter-menu">
                  <button
                    className={filter === 'Todos' ? 'active' : ''}
                    onClick={() => setFilter('Todos')}
                  >
                    Todos
                  </button>
                  <button
                    className={filter === 'Pendiente' ? 'active' : ''}
                    onClick={() => setFilter('Pendiente')}
                  >
                    Pendientes
                  </button>
                  <button
                    className={filter === 'Aceptado' ? 'active' : ''}
                    onClick={() => setFilter('Aceptado')}
                  >
                    Aceptados
                  </button>
                  <button
                    className={filter === 'En preparación' ? 'active' : ''}
                    onClick={() => setFilter('En preparación')}
                  >
                    En preparación
                  </button>
                  <button
                    className={filter === 'Listo' ? 'active' : ''}
                    onClick={() => setFilter('Listo')}
                  >
                    Listos
                  </button>
                  <button
                    className={filter === 'En camino' ? 'active' : ''}
                    onClick={() => setFilter('En camino')}
                  >
                    En camino
                  </button>
                </div>
              </div>
            </div>
            <div className="rs-summary">
              <div>
                <span className="status-pill warning">Pendientes</span>
                <strong>{orders.filter((o) => o.status === 'Pendiente').length}</strong>
              </div>
              <div>
                <span className="status-pill info">En proceso</span>
                <strong>
                  {orders.filter((o) => ['Aceptado', 'En preparación'].includes(o.status)).length}
                </strong>
              </div>
              <div>
                <span className="status-pill gold">Por entregar</span>
                <strong>
                  {orders.filter((o) => ['Listo', 'En camino'].includes(o.status)).length}
                </strong>
              </div>
            </div>
            {filteredActive.length === 0 ? (
              <div className="rs-order-list">
                <div className="hk-empty">
                  <Package size={22} />
                  <p>No hay pedidos pendientes de gestionar</p>
                  <small>Los pedidos finalizados están disponibles en Historial.</small>
                </div>
              </div>
            ) : (
              <PaginatedList
                items={filteredActive}
                getKey={(order) => order.id}
                renderItem={renderOrder}
                listClassName="rs-order-list"
                label="Paginación de pedidos activos"
                resetKey={`${search}:${filter}`}
              />
            )}
          </div>
          <aside className="panel rs-side-panel">
            <div className="panel-heading">
              <div>
                <h3>Resumen de pedidos</h3>
                <p>Estados de los pedidos cargados</p>
              </div>
            </div>
            <div className="rs-shift-card">
              <div>
                <span>Pedidos consultados</span>
                <strong>{orders.length}</strong>
              </div>
              <div>
                <span>Entregados</span>
                <strong>{orders.filter((o) => o.status === 'Entregado').length}</strong>
              </div>
              <div>
                <span>Rechazados</span>
                <strong>{orders.filter((o) => o.status === 'Rechazado').length}</strong>
              </div>
              <div>
                <span>Cancelados</span>
                <strong>{orders.filter((o) => o.status === 'Cancelado').length}</strong>
              </div>
            </div>
            <div className="rs-legend">
              <strong>Flujo del pedido</strong>
              <span>
                <i className="warning" /> Pendiente de aceptación
              </span>
              <span>
                <i className="info" /> Aceptado o en preparación
              </span>
              <span>
                <i className="gold" /> Listo o en camino
              </span>
              <span>
                <i className="success" /> Entregado
              </span>
              <span>
                <i className="terracotta" /> Rechazado o cancelado
              </span>
            </div>
            <div className="rs-legend" style={{ borderTop: 'none', paddingTop: 0 }}>
              <strong>Total de pedidos entregados</strong>
              <span style={{ fontSize: '18px', color: '#9b713d', fontWeight: 700 }}>
                {money(
                  orders
                    .filter((o) => o.status === 'Entregado')
                    .reduce((s, o) => s + orderTotal(o), 0),
                )}
              </span>
            </div>
          </aside>
        </div>
        {selectedOrder && (
          <RoomServiceOrderModal
            order={selectedOrder}
            onClose={onCloseOrder}
            onUpdateStatus={onUpdateStatus}
            onUpdateNote={onUpdateNote}
          />
        )}
        {rejectionOrderId !== null && (
          <div className="modal-backdrop" onMouseDown={() => setRejectionOrderId(null)}>
            <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">RECHAZAR PEDIDO</p>
                  <h2>Indica el motivo</h2>
                </div>
                <button className="icon-btn" onClick={() => setRejectionOrderId(null)}>
                  <X size={18} />
                </button>
              </div>
              <p className="login-helper">
                El huésped podrá consultar por qué no fue posible atender su pedido.
              </p>
              <textarea
                aria-label="Motivo del rechazo"
                maxLength={ORDER_NOTES_MAX_LENGTH}
                className="rs-rejection-textarea"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej. Cocina cerrada temporalmente, ingredientes no disponibles..."
              />
              <div className="modal-foot">
                <button className="button secondary" onClick={() => setRejectionOrderId(null)}>
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={!rejectionReason.trim()}
                  onClick={() => {
                    const id = rejectionOrderId;
                    onReject(id, rejectionReason.trim());
                    setRejectionOrderId(null);
                    setRejectionReason('');
                    onCloseOrder();
                  }}
                >
                  Confirmar rechazo
                </button>
              </div>
            </div>
          </div>
        )}
        {cancelOrderId !== null && (
          <div className="modal-backdrop" onMouseDown={() => setCancelOrderId(null)}>
            <div className="modal" style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">CANCELAR PEDIDO</p>
                  <h2>Indica el motivo</h2>
                </div>
                <button className="icon-btn" onClick={() => setCancelOrderId(null)}>
                  <X size={18} />
                </button>
              </div>
              <p className="login-helper">
                El sistema y el huésped conocerán el estado correcto del pedido.
              </p>
              <textarea
                aria-label="Motivo de la cancelación"
                maxLength={ORDER_NOTES_MAX_LENGTH}
                className="rs-rejection-textarea"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. El huésped no se encuentra en la habitación..."
              />
              <div className="modal-foot">
                <button className="button secondary" onClick={() => setCancelOrderId(null)}>
                  Cerrar
                </button>
                <button
                  className="button primary"
                  disabled={!cancelReason.trim()}
                  onClick={() => {
                    const id = cancelOrderId;
                    onCancel(id, cancelReason.trim());
                    setCancelOrderId(null);
                    setCancelReason('');
                    onCloseOrder();
                  }}
                >
                  Confirmar cancelación
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ---------- Menú ---------- */
  if (nav === 'Menú') {
    return (
      <div className="panel rs-view">
        <div className="panel-heading">
          <div>
            <h3>Menú de Room Service</h3>
            <p>Carta disponible para pedidos de habitación</p>
          </div>
          <button
            className="button small secondary"
            onClick={() => void refreshMenu('Menú actualizado')}
            disabled={refreshingMenu}
          >
            <LoaderCircle size={14} className={refreshingMenu ? 'rc-refresh-spinner' : undefined} />{' '}
            {refreshingMenu ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
        <div className="rs-menu-categories">
          {menuCategories.map((cat) => (
            <span key={cat} className="rs-menu-cat">
              {cat}
            </span>
          ))}
        </div>
        {menuState.status === 'loading' && <LoadingState label="Cargando el menú..." />}
        {menuState.status === 'error' && (
          <ErrorState
            title="No pudimos cargar el menú"
            description={menuState.message}
            onRetry={() => void loadMenu()}
          />
        )}
        {menuState.status === 'ready' && menuItems.length === 0 && (
          <EmptyState
            title="Sin productos"
            description="No hay productos de alimentos y bebidas activos en el catálogo."
          />
        )}
        {menuState.status === 'ready' && menuItems.length > 0 && (
          <div className="rs-menu-grid">
            {pagedMenu.items.map((item) => (
              <div className="rs-menu-item" key={item.name}>
                <div className="rs-menu-icon">
                  <Utensils size={18} />
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <span className="rs-menu-cat-tag">{item.category}</span>{' '}
                  <small className="rs-menu-stock">
                    {item.stock > 0 ? `${item.stock} disponibles` : 'Agotado'}
                  </small>
                </div>
                <b>{money(item.price)}</b>
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={pagedMenu.currentPage}
          totalPages={pagedMenu.totalPages}
          onPageChange={setMenuPage}
          label="Paginación del menú de Room Service"
        />
      </div>
    );
  }

  /* ---------- Historial ---------- */
  if (nav === 'Historial') {
    return (
      <div className="panel rs-view">
        <div className="panel-heading">
          <div>
            <h3>Historial de pedidos</h3>
            <p>Consulta los pedidos entregados, rechazados y cancelados</p>
          </div>
          <button
            className="button small secondary"
            onClick={() => void refreshOrders()}
            disabled={refreshingOrders}
          >
            <LoaderCircle
              size={14}
              className={refreshingOrders ? 'rc-refresh-spinner' : undefined}
            />{' '}
            {refreshingOrders ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
        {completedOrders.length === 0 ? (
          <div className="rs-history-list">
            <div className="hk-empty">
              <FileText size={22} />
              <p>Aún no hay pedidos finalizados</p>
            </div>
          </div>
        ) : (
          <PaginatedList
            items={completedOrders}
            getKey={(order) => order.id}
            listClassName="rs-history-list"
            label="Paginación del historial de pedidos"
            renderItem={(order) => (
              <div className="rs-history-row" key={order.id}>
                <div>
                  <strong>
                    #{order.id} · Habitación {order.room}
                  </strong>
                  <span>
                    {order.guest} · {order.items.length}{' '}
                    {order.items.length === 1 ? 'artículo' : 'artículos'} ·{' '}
                    {money(orderTotal(order))}
                  </span>
                  {order.rejectionReason && (
                    <small style={{ color: '#a9483c' }}>Motivo: {order.rejectionReason}</small>
                  )}
                </div>
                <span className={`status-pill ${statusClass(order.status)}`}>{order.status}</span>
                {order.charged && (
                  <span className="rs-charged">
                    <Check size={13} /> Cargado
                  </span>
                )}
                <button className="button small secondary" onClick={() => onSelectOrder(order.id)}>
                  Ver detalle
                </button>
              </div>
            )}
          />
        )}
        {selectedOrder && (
          <RoomServiceOrderModal
            order={selectedOrder}
            onClose={onCloseOrder}
            onUpdateStatus={onUpdateStatus}
            onUpdateNote={onUpdateNote}
          />
        )}
      </div>
    );
  }

  /* ---------- Inventario ---------- */
  if (nav === 'Inventario') {
    return (
      <div className="panel rs-view">
        <div className="panel-heading">
          <div>
            <h3>Inventario de cocina</h3>
            <p>Insumos disponibles para preparar pedidos</p>
          </div>
          {canWriteInventory && inventoryState.status !== 'forbidden' && (
            <button className="button small primary" onClick={() => setInventoryModalOpen(true)}>
              <Plus size={14} /> Registrar insumo
            </button>
          )}
        </div>
        {(inventoryState.status === 'idle' || inventoryState.status === 'loading') && (
          <LoadingState label="Cargando el inventario..." />
        )}
        {inventoryState.status === 'forbidden' && (
          <EmptyState
            title="Sin acceso al inventario"
            description="Tu rol no tiene permiso para consultar el inventario. Solicita acceso a Administración."
          />
        )}
        {inventoryState.status === 'error' && (
          <ErrorState
            title="No pudimos cargar el inventario"
            description={inventoryState.message}
            onRetry={() => void loadInventory()}
          />
        )}
        {inventoryState.status === 'ready' && inventoryItems.length === 0 && (
          <EmptyState
            title="Sin insumos"
            description="No hay insumos de cocina registrados en el inventario."
          />
        )}
        {inventoryState.status === 'ready' && inventoryItems.length > 0 && (
          <div className="rs-inventory-grid">
            {pagedInventory.items.map((item) => (
              <div className="rs-inventory-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.stock} {item.unit}
                  </span>
                </div>
                <span className={`status-pill ${inventoryStatusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
        {inventoryState.status === 'ready' && (
          <Pagination
            currentPage={pagedInventory.currentPage}
            totalPages={pagedInventory.totalPages}
            onPageChange={setInventoryPage}
            label="Paginación del inventario de cocina"
          />
        )}
        {inventoryModalOpen && (
          <div className="modal-backdrop" onMouseDown={() => setInventoryModalOpen(false)}>
            <div
              className="modal rs-inventory-modal"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rs-inventory-title"
            >
              <div className="modal-head">
                <div>
                  <p className="eyebrow">INVENTARIO DE COCINA</p>
                  <h2 id="rs-inventory-title">Registrar insumo</h2>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => setInventoryModalOpen(false)}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
              <label className="rs-inventory-field">
                Insumo
                <select
                  value={inventoryItemId}
                  onChange={(event) => setInventoryItemId(event.target.value)}
                >
                  {inventoryItems.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedInventoryItem && (
                <p className="rs-inventory-stock">
                  <span>Existencia actual</span>
                  <strong>
                    {selectedInventoryItem.stock} {selectedInventoryItem.unit}
                  </strong>
                </p>
              )}
              <label className="rs-inventory-field">
                Cantidad recibida
                {/* type="text" con teclado numérico: type="number" admite "-", "e" y decimales. */}
                <input
                  className={`rs-inventory-quantity${inventoryQuantityError ? ' error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inventoryQuantity}
                  onChange={(event) => {
                    if (!isWholeNumberInput(event.target.value)) return;
                    setInventoryQuantity(event.target.value);
                    setInventoryQuantityError(undefined);
                  }}
                  aria-required="true"
                  {...fieldErrorProps('rs-inventory-quantity-error', inventoryQuantityError)}
                />
                {inventoryQuantityError && (
                  <span id="rs-inventory-quantity-error" className="hk-form-error">
                    {inventoryQuantityError}
                  </span>
                )}
              </label>
              <label className="rs-inventory-field">
                Observaciones
                <textarea
                  className="rs-inventory-notes"
                  value={inventoryNotes}
                  onChange={(event) => setInventoryNotes(event.target.value)}
                  placeholder="Ej. Reposición de turno, compra de cocina..."
                />
              </label>
              <div className="modal-foot">
                <button
                  className="button secondary"
                  onClick={() => setInventoryModalOpen(false)}
                  disabled={inventorySaving}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={inventorySaving || inventoryItems.length === 0}
                  onClick={() => void registerInventoryMovement()}
                >
                  Registrar movimiento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function RoomServiceOrderModal({
  order,
  onClose,
  onUpdateStatus,
  onUpdateNote,
}: {
  order: RoomServiceOrder;
  onClose: () => void;
  onUpdateStatus: (id: number, status: OrderStatus) => void;
  onUpdateNote: (id: number, note: string) => void;
}) {
  const [note, setNote] = useState(order.note);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rs-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">DETALLE DE PEDIDO</p>
            <h2>Pedido #{order.id}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="rs-detail-header">
          <div>
            <strong>Habitación {order.room}</strong>
            <span>
              {order.guest} · recibido a las {order.time}
            </span>
          </div>
          <span className={`status-pill ${statusClass(order.status)}`}>{order.status}</span>
        </div>
        <div className="rs-detail-items">
          {order.items.map((item, i) => (
            <div key={i}>
              <span>
                <strong>{item.quantity}×</strong> {item.name} · {money(item.price)} c/u
              </span>
              <span>{money(item.quantity * item.price)}</span>
            </div>
          ))}
        </div>
        <div className="rs-detail-total">
          <span>Total del pedido</span>
          <strong>{money(orderTotal(order))}</strong>
        </div>
        {order.rejectionReason && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: '#f2d6cd',
              borderRadius: 8,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <Ban size={16} style={{ color: '#a9483c', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 11, color: '#a9483c', display: 'block' }}>
                Motivo de rechazo
              </strong>
              <p style={{ fontSize: 11, color: '#a9483c', margin: '4px 0 0' }}>
                {order.rejectionReason}
              </p>
            </div>
          </div>
        )}
        <label className="rs-note-label">
          Observaciones
          <textarea
            maxLength={ORDER_NOTES_MAX_LENGTH}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Agrega información sobre la preparación o entrega..."
          />
        </label>
        <div className="rs-detail-actions">
          <button className="button secondary" onClick={() => onUpdateNote(order.id, note)}>
            Guardar observación
          </button>
          {order.status === 'Pendiente' && (
            <button
              className="button primary"
              onClick={() => {
                onUpdateStatus(order.id, 'Aceptado');
              }}
            >
              Aceptar pedido
            </button>
          )}
          {order.status === 'Aceptado' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(order.id, 'En preparación')}
            >
              En preparación
            </button>
          )}
          {order.status === 'En preparación' && (
            <button className="button primary" onClick={() => onUpdateStatus(order.id, 'Listo')}>
              Marcar listo
            </button>
          )}
          {order.status === 'Listo' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(order.id, 'En camino')}
            >
              En camino
            </button>
          )}
          {order.status === 'En camino' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(order.id, 'Entregado')}
            >
              Entregado
            </button>
          )}
          {order.status === 'Entregado' && order.charged && (
            <span className="rs-charged">
              <Check size={15} /> Consumo cargado a la habitación
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
