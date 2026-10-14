import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { DatePickerRange, type DateRangeValue } from '@/shared/components/DatePickerRange';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Modal } from '@/shared/components/Modal';
import { Pagination } from '@/shared/components/Pagination';
import { Select } from '@/shared/components/Select';
import { RetryExample } from '@/modules/ui-catalog/components/RetryExample';
import {
  getCatalogRecords,
  type CatalogRecord,
} from '@/modules/ui-catalog/services/catalog-service';
import './components-catalog.css';

const tones: { tone: BadgeTone; label: string }[] = [
  { tone: 'neutral', label: 'Neutral' },
  { tone: 'info', label: 'Información' },
  { tone: 'success', label: 'Éxito' },
  { tone: 'warning', label: 'Advertencia' },
  { tone: 'danger', label: 'Error' },
];
const columns: DataTableColumn<CatalogRecord>[] = [
  { id: 'name', header: 'Habitación', cell: (row) => row.name, sortValue: (row) => row.name },
  {
    id: 'capacity',
    header: 'Capacidad',
    cell: (row) => `${row.capacity} personas`,
    sortValue: (row) => row.capacity,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (row) => (
      <Badge
        tone={
          row.status === 'Disponible' ? 'success' : row.status === 'Ocupada' ? 'info' : 'warning'
        }
      >
        {row.status}
      </Badge>
    ),
    sortValue: (row) => row.status,
  },
];

export function ComponentsCatalogPage() {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [showEmpty, setShowEmpty] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [stayRange, setStayRange] = useState<DateRangeValue>({ start: null, end: null });
  const [emailError, setEmailError] = useState(false);
  useEffect(() => {
    let active = true;
    getCatalogRecords()
      .then((rows) => {
        if (active) {
          setRecords(rows);
          setStatus('success');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);
  async function reload() {
    setStatus('loading');
    try {
      setRecords(await getCatalogRecords());
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="ui-catalog">
      <header className="ui-catalog__header">
        <div>
          <p className="ui-catalog__eyebrow">HOTEL AURORA / BIBLIOTECA DE INTERFAZ</p>
          <h1>
            Detalles que dan forma
            <br />a la experiencia.
          </h1>
          <p>Componentes de presentación, estados y ejemplos interactivos en un solo lugar.</p>
        </div>
        <Link className="ui-action" to={routePaths.public.home}>
          Volver al inicio
        </Link>
      </header>
      <nav className="ui-catalog__nav" aria-label="Secciones del catálogo">
        {[
          ['cards', 'Tarjetas'],
          ['badges', 'Indicadores'],
          ['states', 'Estados'],
          ['table', 'Tabla'],
          ['forms', 'Formularios'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <section className="ui-catalog__section" id="cards" aria-labelledby="cards-title">
        <h2 id="cards-title">01 / Tarjetas</h2>
        <p>Un contenedor claro para cada grupo de información.</p>
        <div className="ui-catalog__grid">
          <Card
            title="Con borde"
            description="Variante outlined"
            footer={<Badge>Información complementaria</Badge>}
          >
            <p>Contenido con encabezado, descripción y pie opcional.</p>
          </Card>
          <Card title="Con elevación" description="Variante raised" variant="raised">
            <p>Una sombra sutil para destacar una sección.</p>
          </Card>
          <Card title="Fondo suave" description="Variante muted" variant="muted">
            <p>Ideal para información de apoyo.</p>
          </Card>
        </div>
      </section>
      <section className="ui-catalog__section" id="badges" aria-labelledby="badges-title">
        <h2 id="badges-title">02 / Indicadores</h2>
        <p>Texto y color juntos; el significado siempre se puede leer.</p>
        <Card title="Cinco tonos, dos tamaños">
          <div className="ui-catalog__stack">
            {(['medium', 'small'] as const).map((size) => (
              <div className="ui-catalog__row" key={size}>
                <span>{size === 'medium' ? 'Mediano' : 'Pequeño'}</span>
                {tones.map(({ tone, label }) => (
                  <Badge key={tone} tone={tone} size={size}>
                    {label}
                  </Badge>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="ui-catalog__section" id="states" aria-labelledby="states-title">
        <h2 id="states-title">03 / Estados de pantalla</h2>
        <p>Sin resultados, en proceso o con un error recuperable.</p>
        <div className="ui-catalog__grid">
          <Card title="Sin resultados">
            <EmptyState
              description="Prueba la tabla vacía en el ejemplo de abajo."
              action={
                <a className="ui-action" href="#table">
                  Ir a la tabla
                </a>
              }
            />
          </Card>
          <Card title="Cargando">
            <LoadingState />
            <LoadingState variant="inline" label="Versión compacta" />
          </Card>
          <Card title="Error y recuperación">
            <RetryExample />
          </Card>
        </div>
      </section>
      <section className="ui-catalog__section" id="table" aria-labelledby="table-title">
        <h2 id="table-title">04 / Tabla y paginación</h2>
        <p>Ordena las columnas y recorre las páginas sin recargar.</p>
        <Card
          title="Habitaciones de ejemplo"
          description="13 registros · 5 por página"
          footer={
            <button className="ui-action" type="button" onClick={() => setShowEmpty(!showEmpty)}>
              {showEmpty ? 'Mostrar registros' : 'Mostrar tabla vacía'}
            </button>
          }
        >
          {status === 'loading' ? (
            <LoadingState />
          ) : status === 'error' ? (
            <ErrorState onRetry={reload} />
          ) : (
            <DataTable
              columns={columns}
              data={showEmpty ? [] : records}
              getRowId={(row) => row.id}
              caption="Habitaciones de ejemplo"
            />
          )}
        </Card>
        <Card
          title="Paginación independiente"
          description="Los extremos deshabilitan las acciones que no aplican."
        >
          <Pagination
            currentPage={page}
            totalPages={3}
            onPageChange={setPage}
            label="Paginación de ejemplo"
          />
        </Card>
      </section>
      <section className="ui-catalog__section" id="forms" aria-labelledby="forms-title">
        <h2 id="forms-title">05 / Componentes de formulario (WEB-04)</h2>
        <p>Button, Input, Select, Modal y DatePickerRange, en sus variantes y estados.</p>
        <div className="ui-catalog__grid">
          <Card title="Button" description="Variantes y tamaños">
            <div className="ui-catalog__stack">
              <div className="ui-catalog__row">
                <Button variant="primary">Primario</Button>
                <Button variant="secondary">Secundario</Button>
                <Button variant="ghost">Fantasma</Button>
                <Button variant="danger">Peligro</Button>
              </div>
              <div className="ui-catalog__row">
                <Button size="sm">Pequeño</Button>
                <Button size="md">Mediano</Button>
                <Button size="lg">Grande</Button>
                <Button loading>Cargando</Button>
                <Button disabled>Deshabilitado</Button>
              </div>
            </div>
          </Card>
          <Card title="Input" description="Con etiqueta, ayuda y error">
            <div className="ui-catalog__stack">
              <Input
                label="Nombre"
                helpText="Como aparece en el documento."
                placeholder="Ana López"
              />
              <Input
                label="Correo"
                type="email"
                value={emailError ? 'correo-invalido' : ''}
                onChange={(event) => setEmailError(!event.target.value.includes('@'))}
                error={emailError ? 'Ingresa un correo válido.' : undefined}
              />
              <Input label="Deshabilitado" disabled placeholder="No editable" />
            </div>
          </Card>
          <Card title="Select" description="Con etiqueta y ayuda">
            <Select label="Tipo de habitación" helpText="Según disponibilidad." defaultValue="">
              <option value="" disabled>
                Selecciona una opción
              </option>
              <option value="estandar">Estándar</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
            </Select>
          </Card>
          <Card
            title="Modal"
            description="Cierre con Escape, clic en el overlay y foco gestionado"
            footer={
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Abrir modal
              </Button>
            }
          >
            <p>Confirma una acción con nombre accesible obligatorio.</p>
          </Card>
          <Card title="DatePickerRange" description="Rango de estadía, sin librería externa">
            <DatePickerRange
              label="Fechas de la estadía"
              helpText="Entrada y salida."
              value={stayRange}
              onChange={setStayRange}
              minDate={new Date()}
            />
          </Card>
        </div>
      </section>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirmar acción">
        <p>Este modal usa el primitivo compartido de WEB-04.</p>
        <div className="ui-catalog__row">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
        </div>
      </Modal>
      <footer className="ui-catalog__footer">
        <p>Catálogo de primitivos de presentación (WEB-13) y de formulario (WEB-04).</p>
      </footer>
    </main>
  );
}
