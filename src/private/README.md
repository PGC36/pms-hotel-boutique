# Zona Privada

Nota 2026-09-27 (#89): en escritorio el layout privado mantiene fijo el
sidebar y el header superior; el scroll ocurre dentro de `.main-area`. El
sidebar conserva marca/cabecera y ayuda al fondo, y solo `.side-nav` desplaza
su contenido interno cuando no cabe en el viewport.

Aquí se compone la experiencia autenticada para empleados y administración.

`page.tsx` mantiene el layout y menú principal. `guards/` controla sesión y
permisos; `routes/` define la navegación privada; `pages/` compone las vistas
con los módulos de negocio; `components/` guarda piezas exclusivas del layout.
