# Pruebas de extremo a extremo del portal del comercio

```bash
npm run test:e2e            # contra el servidor de desarrollo (puerto 3010)
PW_BASE_URL=http://localhost:3010 npm run test:e2e
```

## Qué prueban y qué NO

`partner-dossier.spec.ts` recorre el expediente del negocio entero —abrir, sucursal, QR del
negocio, QR bancario, terminal POS y envío— contra un **backend simulado con estado**
(`support/partner-dossier-backend.ts`). Es un doble con memoria y no un juego de respuestas fijas
a propósito: lo que hay que comprobar es que el embudo de requisitos **encoge** a medida que se
completa el trámite, y con respuestas fijas la pantalla parecería avanzar sin que nada avance.

Lo que este simulado **no** prueba es que AtlasBackend se comporte así. Eso lo prueba
`yarn smoke:partner-onboarding` en AtlasBackend, contra servidor y base reales. Son las dos
mitades y ninguna sustituye a la otra: un simulado prueba que la vista sabe pintar la forma que
este repositorio CREE que el backend sirve.

## Evidencia visual

Cada corrida deja capturas en `docs/visual-evidence/expediente/`. Se versionan porque son
documentación del flujo, no un artefacto de la corrida.

## Contra el backend REAL

Hace falta lo que el simulado se salta, y conviene saberlo antes de intentarlo:

1. **Sesión de comercio de verdad** (`/auth/merchant/login` en este backend), no un token en
   `localStorage`.
2. **AtlasBackend levantado** y alcanzable desde el ERP backend (`ATLAS_IDENTITY_BASE_URL`), con
   su migración `20260819140000-create-partner-onboarding` aplicada.
3. **Almacenamiento de objetos configurado** (`STORAGE_S3_*` en AtlasBackend). Sin él, la subida
   del QR responde `503 DOCUMENT_STORAGE_NOT_CONFIGURED` — el flujo se corta ahí, y es correcto
   que se corte: el expediente no debe registrar una evidencia que no existe.

Mientras el punto 3 no esté resuelto en un entorno, la subida del QR **no está probada de punta a
punta contra infraestructura real** en ninguna de las dos baterías. Está dicho aquí en vez de
dejarlo pasar en silencio.

## Ojo con el servidor de desarrollo

No corras `npm run build` con el servidor de desarrollo levantado: reescribe `.next` y el servidor
en marcha se queda con módulos que ya no existen —la página sirve 200 y carga sus recursos con
404, así que se ve en blanco sin decir por qué—. Se cura parando el servidor, borrando `.next` y
arrancando de nuevo.

## El QR se comprueba LEYENDOLO

`mi-empresa-real.spec.ts` cubre «Mi empresa» contra el backend real: que la pantalla reconozca el
expediente ya existente, que el rubro sea un catálogo que muestre el valor guardado, y que al abrir
una sucursal aparezca el QR de su caja.

Ese último punto no se puede dar por bueno mirando la captura. Un QR mal codificado —un fallo en la
corrección de errores o en la máscara— se ve exactamente igual de cuadriculado que uno bueno, y el
error aparece recién en la caja, con el cliente delante. Por eso la prueba guarda el QR recortado y
se verifica aparte con el lector de códigos del sistema:

```bash
npx playwright test e2e/mi-empresa-real.spec.ts
python3 scripts/verificar-qr.py docs/visual-evidence/portal-comercio/qr-sucursal-cpa.png CPA-CENTRO-01
```

El generador (`lib/qr.ts`) no tiene dependencias, así que nadie más garantiza que su salida sea
legible: esa segunda orden es la que lo garantiza.
