# Auditoría de reconstrucción contra las vistas originales

## Criterio

Se revisaron las 39 carpetas que contienen `screen.png` y, cuando estaba disponible, `code.html`. También se aplicó el sistema visual de `atlas_erp/DESIGN.md`.

La reconstrucción evita tres errores del frontend anterior:

1. No convierte flujos complejos en tablas genéricas.
2. No obliga al operador a pegar JSON.
3. No reemplaza un dashboard real por un mapa de enlaces.

## Matriz vista por vista

| Vista original | Ruta Next.js | Implementación actual |
|---|---|---|
| `dashboard_ejecutivo_atlas_erp` | `/operaciones` | Dashboard ejecutivo con KPIs, alertas, actividad y accesos por dominio usando datos reales agregados. |
| `cuentas_b2b_atlas` | `/operaciones/crm/cuentas` | Directorio B2B con filtros, estados, paginación y acceso a detalle. |
| `crear_cuenta_b2b_atlas` | `/operaciones/crm/cuentas/crear` | Formulario especializado de alta de cuenta. |
| `detalle_de_cuenta_atlas` | `/operaciones/crm/cuentas/detalle` | Resumen 360, calificación, acciones y trazabilidad de cuenta. |
| `calificar_cuenta_atlas` | `/operaciones/crm/cuentas/calificar` | Formulario de calificación alineado al schema real. |
| `bulk_cuentas_b2b_atlas_2` | `/operaciones/crm/bulk-cuentas` | Importación masiva con staging, validación y reporte. |
| `pipeline_de_oportunidades_atlas` | `/operaciones/crm/oportunidades` | Pipeline visual por etapas con movimiento controlado. |
| `propuesta_comercial_atlas` | `/operaciones/crm/propuestas` | Editor de propuesta con líneas, totales y acciones comerciales. |
| `cola_de_aprobaciones_atlas` | `/operaciones/crm/aprobaciones` | Cola de revisión con decisión, motivo y contexto. |
| `crear_contrato_comercial_atlas` | `/operaciones/crm/contratos` | Flujo de contrato comercial y acciones de ciclo de vida. |
| `gesti_n_de_onboarding_atlas` | `/operaciones/crm/onboarding` | Caso de onboarding con checklist y avance por hitos. |
| `activaci_n_de_comercio_atlas` | `/operaciones/crm/activacion-comercio` | Activación operativa con verificaciones y aprobación. |
| `facturaci_n_b2b_atlas` | `/operaciones/crm/facturacion` | Emisión de factura y registro de pago del comercio. |
| `conciliaci_n_y_cobertura_atlas` | `/operaciones/crm/conciliacion-cobertura` | Programación de cobertura y conciliación. |
| `crear_entidad_legal_atlas` | `/operaciones/contabilidad/estructura` | Entidades legales y estructura contable. |
| `sucursales_y_a_os_fiscales_atlas` | `/operaciones/contabilidad/sucursales-fiscales` | Sucursales, años fiscales y acciones asociadas. |
| `per_odos_y_ledgers_atlas` | `/operaciones/contabilidad/periodos-ledgers` | Gestión separada de períodos y libros. |
| `impuestos_y_versiones_coa_atlas` | `/operaciones/contabilidad/impuestos-coa` | Impuestos y versiones del plan de cuentas. |
| `gesti_n_de_cuentas_gl_atlas` | `/operaciones/contabilidad/cuentas-gl` | Directorio GL con búsqueda y paginación. |
| `business_partners_atlas` | `/operaciones/contabilidad/business-partners` | Directorio de terceros contables. |
| `contratos_contables_atlas` | `/operaciones/contabilidad/contratos` | Contratos contables y acciones de estado. |
| `crear_documento_contable_atlas` | `/operaciones/contabilidad/documentos` | Documento con líneas dinámicas y control de balance. |
| `bulk_documentos_contables_atlas` | `/operaciones/contabilidad/bulk-documentos` | Carga masiva con prevalidación y resultado. |
| `factura_ar_contable_atlas` | `/operaciones/contabilidad/factura-ar` | Emisión de factura por cobrar. |
| `registrar_recibo_contable_atlas` | `/operaciones/contabilidad/recibos` | Recibo con aplicaciones dinámicas. |
| `cierre_de_per_odos_atlas` | `/operaciones/contabilidad/cierres` | Flujo de cierre y reapertura de período. |
| `directorio_de_anunciantes_atlas_ads` | `/operaciones/ads/anunciantes` | Directorio de anunciantes con estados y paginación. |
| `bulk_anunciantes_ads_atlas` | `/operaciones/ads/bulk-anunciantes` | Importación masiva de anunciantes. |
| `gesti_n_de_campa_as_atlas_ads` | `/operaciones/ads/campanas` | Gestión de campañas y transición de estado. |
| `cola_de_moderaci_n_atlas_ads` | `/operaciones/ads/moderacion` | Cola visual de creatividades con decisión y observaciones. |
| `monitor_de_delivery_y_fraude_atlas_ads` | `/operaciones/ads/delivery-monitor` | Monitor de entrega, fraude y clasificación facturable. |
| `business_action_log_atlas` | `/operaciones/auditoria/business-actions` | Registro de acciones de negocio con filtros y trazabilidad. |
| `administraci_n_de_usuarios_y_seguridad_atlas` | `/operaciones/admin/seguridad` | Administración visual de seguridad; operaciones persistentes quedan bloqueadas hasta existir contrato backend. |
| `gesti_n_de_roles_y_permisos_atlas` | `/operaciones/admin/roles` | Matriz visual de roles/permisos; no simula escrituras inexistentes. |
| `centro_de_notificaciones_y_alertas_atlas` | `/operaciones/admin/notificaciones` | Centro de alertas operativas con estados y priorización visual. |
| `centro_de_comando_y_b_squeda_global_atlas` | `/operaciones/admin/busqueda-global` | Centro de comando con búsqueda local de navegación y acciones disponibles. |
| `mapa_del_sitio_y_navegaci_n_atlas_erp` | `/operaciones/admin/mapa-sitio` | Navegador completo del producto agrupado por áreas. |
| `sucursales_y_usuarios_merchant_atlas` | `/portal-comercio/sucursales-usuarios` | Alta especializada de sucursal y usuario de comercio en shell separado. |
| `registrar_compra_bnpl_atlas` | `/portal-comercio/compras-bnpl` | Registro BNPL 60/40 con cronograma dinámico y validación de sumas. |

## Brechas backend tratadas honestamente

Las vistas administrativas de usuarios, roles, notificaciones y búsqueda global no cuentan con contratos completos en el backend entregado. Se reconstruyó su diseño y navegación, pero no se inventaron endpoints ni persistencia.

## Resultado

Las vistas ahora son pantallas operativas especializadas. Los componentes compartidos se limitan a elementos visuales realmente repetidos: encabezados, paneles, estados, campos, botones, métricas e indicadores.
