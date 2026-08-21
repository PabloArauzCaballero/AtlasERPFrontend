# Motor de tutoriales del ERP

Dos piezas complementarias que responden a dos preguntas distintas. Conviene no
confundirlas, porque casi todos los errores al añadir contenido vienen de eso:

| Pieza | Pregunta que responde | Dónde se lee | Cobertura |
| --- | --- | --- | --- |
| **Guía de pantalla** (`ScreenGuide`) | «¿Qué estoy viendo aquí?» | Panel lateral, sin tocar nada | **Todas** las vistas |
| **Recorrido interactivo** (`InteractiveTutorial`) | «¿Cómo hago esto?» | Sobre la interfaz real, paso a paso | Los flujos principales |

## Dónde aparecen

Los dos botones viven en `WorkspaceHeader`, junto al título. **No hay que
declararlos en cada pantalla**: `ScreenGuideButton` resuelve su contenido por la
RUTA. Eso es lo que hace que la ayuda exista en las cincuenta y tantas vistas y
que no haya forma de olvidarse de una al añadir la siguiente.

El Centro de Tutoriales está en `/operaciones/tutoriales` y
`/portal-comercio/tutoriales`, con enlace propio arriba del menú lateral —arriba,
porque quien lo necesita es precisamente quien todavía no entiende los grupos.

## Añadir una guía de pantalla

Una entrada más en el archivo del módulo que corresponda, bajo
`components/tutorial/guias/`, indexada por su ruta:

```ts
'/operaciones/crm/cuentas': {
  eyebrow: 'CRM B2B',
  title: 'Cuentas B2B',
  intro: 'Una frase, sin jerga: qué es esta pantalla.',
  sections: [{ title: '…', body: '…', tip: '…' }],
  backend: 'GET /b2b/accounts',   // se muestra plegado
  tutorialId: 'crm-cuentas',      // opcional
}
```

El orden de las secciones que funciona: **qué es → qué se hace → qué NO hace →
qué mirar cuando algo falla**. La última suele ser la más útil y es la que casi
siempre falta.

Si una ruta no tiene entrada propia, `resolveGuide` cae en el prefijo más largo
—la ficha hereda la guía de su listado—. Es impreciso pero cierto, y mejor que
quedarse mudo: una pantalla sin ayuda enseña a dejar de buscarla.

## Añadir un recorrido interactivo

1. La definición, en un archivo de `components/tutorial/tours/`.
2. Su ficha de catálogo, en `tutorial-registry.ts`.

El motor no se toca.

```ts
{
  id: 'crm-cuentas',
  title: 'Registrar y calificar una cuenta B2B',
  intro: 'Para qué sirve el recorrido.',
  version: 1,                       // súbela al reescribir los pasos
  steps: [
    {
      id: 'buscar',
      route: '/operaciones/crm/cuentas',        // sólo en los pasos que CAMBIAN de pantalla
      target: '[data-tutorial-id="directory-search"]',
      title: 'Antes de crear, busca',
      content: '…',
      tip: '…',
      requiredAction: 'input',      // espera la acción real; sin esto avanza con «Siguiente»
      optional: true,               // se salta si su elemento no está en pantalla
    },
  ],
}
```

Reglas que ahorran depuración:

- **Apunta a `[data-tutorial-id="…"]`, nunca a clases.** Las clases de Tailwind
  cambian al rediseñar y el recorrido se queda señalando el vacío sin avisar.
- **La ruta se hereda del paso anterior.** Un recorrido de una sola pantalla la
  escribe una vez.
- **`dynamicRoute` para las fichas de detalle.** Su ruta depende del registro que
  el usuario abra; sin cortar la herencia, el motor lo devuelve al listado en
  bucle.
- **Marca `optional` lo que puede no existir.** Una tabla vacía en un entorno
  recién sembrado no puede dejar el recorrido esperando un clic imposible.
- **Sube `version` al reescribir.** Quien ya lo hizo pasa a «Actualizado» y se le
  vuelve a ofrecer, sin perder que lo había completado.

## Anclas disponibles

Ya marcadas en el armazón y en las pantallas compartidas, así que sirven en
muchas vistas a la vez:

`sidebar-nav`, `sidebar-dashboard`, `portal-nav`, `topbar-search`,
`topbar-profile`, `workspace-header`, `screen-guide-button`,
`screen-tour-button`, `directory-metrics`, `directory-filters`,
`directory-search`, `directory-create`, `resource-table`, `action-form`,
`action-submit`, `action-summary`, `workspace-action-cards`,
`workspace-sequence`, `kanban-board`, `document-lines`, `document-totals`,
`bulk-preview`, `bnpl-schedule`, `onboarding-checklist`, `tutorial-center`.

## Progreso

Vive en `localStorage` (`atlas.erp.tutorial.progress`), detrás de la interfaz
`TutorialStore`. Se guarda estado, paso, versión, fechas y repeticiones.

**Limitación conocida y deliberada:** el avance es de ESE navegador; quien entre
desde otro equipo empieza de cero. El ERP no expone hoy un endpoint de progreso.
Cuando lo tenga —el contrato que ya usa DecisionEngine es
`GET /tutorial-progress` y `PUT /tutorial-progress/:id`— basta con implementar
otro `TutorialStore`; el motor no cambia. Se prefirió esto a inventar un endpoint
inexistente y tragarse el 404 en silencio, que se lee como un backend caído.

## Accesibilidad

- Escape cierra el recorrido y el panel; las flechas ← → recorren los pasos.
- El foco vuelve al botón que abrió cada capa.
- El overlay del recorrido **no** declara `aria-modal`: los pasos piden pulsar
  elementos REALES de la página, y declararlo modal le diría al lector de
  pantalla que todo lo de fuera está inerte justo cuando hay que ir a usarlo.
- `prefers-reduced-motion` desactiva las transiciones.
- Overlay y panel se montan en un portal sobre `<body>`: `main` lleva
  `relative z-10` para pintarse sobre el fondo ambiental, y eso crea un contexto
  de apilado que dejaba el panel por debajo de la barra superior.
