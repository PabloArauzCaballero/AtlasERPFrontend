import type { Page, Route } from '@playwright/test';

/**
 * Backend simulado del expediente del partner, con el MISMO contrato que sirve AtlasBackend.
 *
 * Es un doble con estado —no una colección de respuestas fijas— y esa diferencia es la que hace
 * que la prueba valga: el embudo de requisitos tiene que ENCOGER a medida que se completa el
 * trámite, y con respuestas fijas la pantalla parecería avanzar sin que nada avance. Aquí, subir
 * el QR bancario quita de verdad `bank_qr` de la lista.
 *
 * Lo que este doble NO prueba es que AtlasBackend se comporte así: eso lo prueba
 * `yarn smoke:partner-onboarding` contra el servidor y la base reales. Aquí se prueba que la
 * pantalla sabe recorrer el contrato entero y pintar cada estado.
 */

interface Branch {
  erpBranchId: string | null;
  branchId: string;
  branchCode: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  status: string;
}

interface QrCode {
  qrId: string;
  qrKind: 'business' | 'bank';
  branchId: string | null;
  fingerprint: string;
  bankInstitutionCode: string | null;
  accountNumberMasked: string | null;
  status: string;
  replacedById: string | null;
  createdAt: string;
}

interface PosTerminal {
  terminalId: string;
  branchId: string;
  terminalSerial: string;
  terminalAlias: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  activatedAt: string | null;
}

interface DossierState {
  partnerId: string;
  legalName: string;
  taxId: string;
  commercialRegistry: string | null;
  onboardingStatus: string;
  branches: Branch[];
  qrCodes: QrCode[];
  posTerminals: PosTerminal[];
}

const MERCHANT = {
  id: '1',
  email: 'comercio@atlas.test',
  fullName: 'Comercio de prueba',
  role: 'merchant',
  status: 'active',
};

function json(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, data }),
  });
}

/** Las mismas reglas de `PartnerProfileService.findSubmissionGaps`, para que el embudo coincida. */
function gapsOf(state: DossierState) {
  const gaps: Array<{ requirement: string; detail: string }> = [];
  if (!state.commercialRegistry) {
    gaps.push({ requirement: 'commercial_registry', detail: 'Falta la matrícula de comercio.' });
  }
  gaps.push({ requirement: 'legal_representative', detail: 'Falta declarar al representante legal.' });
  if (state.branches.length === 0) {
    gaps.push({ requirement: 'branch', detail: 'Falta registrar al menos una sucursal.' });
  }
  const live = state.qrCodes.filter((qr) => qr.status === 'pending_review' || qr.status === 'active');
  if (!live.some((qr) => qr.qrKind === 'business')) {
    gaps.push({ requirement: 'business_qr', detail: 'Falta subir el QR del negocio.' });
  }
  if (!live.some((qr) => qr.qrKind === 'bank')) {
    gaps.push({ requirement: 'bank_qr', detail: 'Falta subir el QR bancario de cobro.' });
  }
  return gaps;
}

/**
 * Instala el doble y devuelve su estado, para poder afirmar sobre lo que el backend RECIBIÓ.
 *
 * Se expone el estado en vez de sólo interceptar porque hay cosas que sólo se ven desde este lado:
 * que el QR se registrara con la sigla ASFI que se escribió, o que el terminal se colgara de la
 * sucursal elegida y no de otra.
 */
export async function installPartnerDossierBackend(page: Page) {
  const state: DossierState = {
    partnerId: '',
    legalName: '',
    taxId: '',
    commercialRegistry: null,
    onboardingStatus: 'draft',
    branches: [],
    qrCodes: [],
    posTerminals: [],
  };
  let sequence = 0;
  const next = () => String(++sequence);

  // Sesión de comercio: sin ella `RequireAuth audience="merchant"` devuelve al login.
  await page.route('**/api/v1/auth/merchant/me', (route) => json(route, 200, { user: MERCHANT }));

  /*
   * Las sucursales del ERP: la lista donde un local se da de alta de verdad.
   *
   * El expediente ya no las inventa, las DECLARA, así que sin esta ruta el desplegable saldría vacío
   * y el paso de la sucursal no se podría hacer. Son dos para que la prueba distinga: al declarar la
   * primera, la segunda tiene que seguir ofreciéndose y la primera no.
   */
  await page.route('**/api/v1/portal/branches*', (route) =>
    json(route, 200, [
      { id: 'erp-branch-1', name: 'Sucursal Centro', city: 'Santa Cruz', address: 'Av. Monseñor Rivero 100', status: 'ACTIVE' },
      { id: 'erp-branch-2', name: 'Sucursal Norte', city: 'Santa Cruz', address: 'Av. Banzer 2000', status: 'ACTIVE' },
    ]),
  );

  await page.route('**/api/v1/partner-onboarding/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/partner-onboarding', '');
    const method = request.method();
    const body = request.postData() ? (JSON.parse(request.postData() as string) as Record<string, string>) : {};

    /*
     * «¿Cuál es MI expediente?», que es lo primero que pregunta la pantalla.
     *
     * El simulador no lo implementaba —es posterior a él— y su respuesta por defecto era un 404.
     * La pantalla trata ese fallo como «no pude preguntar» y NO como «no tiene expediente» (a
     * propósito: confundirlos empuja a abrir uno duplicado), así que se quedaba en «Comprobando…»
     * para siempre y la batería entera moría en su primera aserción.
     *
     * Devuelve la lista vacía mientras no se haya abierto ninguno, que es el estado en el que
     * empieza cada prueba, y el expediente en curso una vez creado.
     */
    if (method === 'GET' && path === '/mine') {
      return json(route, 200, {
        profiles: state.partnerId
          ? [{ partnerId: state.partnerId, legalName: state.legalName, onboardingStatus: state.onboardingStatus }]
          : [],
      });
    }

    if (method === 'POST' && path === '/start') {
      state.partnerId = next();
      state.legalName = body.legalName ?? '';
      state.taxId = body.taxId ?? '';
      state.commercialRegistry = body.commercialRegistry ?? null;
      return json(route, 201, {
        partnerId: state.partnerId,
        legalName: state.legalName,
        tradeName: body.tradeName ?? null,
        taxId: state.taxId,
        commercialRegistry: state.commercialRegistry,
        businessCategory: null,
        contactEmail: body.contactEmail ?? '',
        contactPhone: body.contactPhone ?? null,
        emailVerified: false,
        phoneVerified: false,
        onboardingStatus: 'draft',
        submittedAt: null,
        decidedAt: null,
        rejectionReason: null,
        erpAccountId: null,
      });
    }

    if (method === 'GET' && path.endsWith('/status')) {
      const gaps = gapsOf(state);
      return json(route, 200, {
        profile: {
          partnerId: state.partnerId,
          legalName: state.legalName,
          tradeName: null,
          taxId: state.taxId,
          commercialRegistry: state.commercialRegistry,
          businessCategory: null,
          contactEmail: 'comercio@atlas.test',
          contactPhone: null,
          emailVerified: false,
          phoneVerified: false,
          onboardingStatus: state.onboardingStatus,
          submittedAt: null,
          decidedAt: null,
          rejectionReason: null,
          erpAccountId: null,
        },
        gaps,
        readyToSubmit: gaps.length === 0,
        branches: state.branches,
        qrCodes: state.qrCodes,
        posTerminals: state.posTerminals,
      });
    }

    if (method === 'POST' && path.endsWith('/branches')) {
      const branch: Branch = {
        branchId: next(),
        branchCode: body.branchCode ?? '',
        name: body.name ?? '',
        addressLine: body.addressLine ?? null,
        city: body.city ?? null,
        status: 'active',
        // El puente con el ERP. Se guarda tal como llega para que la prueba pueda AFIRMAR que la
        // pantalla lo mandó: sin él vuelven a existir dos verdades sobre el mismo local.
        erpBranchId: body.erpBranchId ?? null,
      };
      state.branches.push(branch);
      return json(route, 201, branch);
    }

    /*
     * La lista de QR por su cuenta, que es como la pide «Mi QR de cobro».
     *
     * El expediente los leía dentro de su estado completo y por eso esta ruta no hacía falta.
     * Desde que los dos códigos se suben en su propia pantalla, sí: sin ella la pantalla recibe un
     * 404 y enseña «todavía no lo has subido» justo después de subirlo.
     */
    if (method === 'GET' && path.endsWith('/qr-codes')) {
      return json(route, 200, state.qrCodes);
    }

    if (method === 'POST' && path.endsWith('/qr-codes/upload-url')) {
      return json(route, 201, {
        storageKey: `1/partner-${state.partnerId}/qr-${body.qrKind}/${next()}.png`,
        uploadUrl: 'https://storage.atlas.test/upload',
        method: 'PUT',
        requiredHeaders: { 'content-type': body.contentType, 'content-length': String(body.sizeBytes) },
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    }

    if (method === 'POST' && path.endsWith('/qr-codes')) {
      const kind = body.qrKind === 'bank' ? 'bank' : 'business';
      // Un QR nuevo REEMPLAZA al vigente del mismo tipo; el anterior no se borra.
      for (const existing of state.qrCodes) {
        if (existing.qrKind === kind && existing.status !== 'replaced') existing.status = 'replaced';
      }
      const qr: QrCode = {
        qrId: next(),
        qrKind: kind,
        branchId: null,
        fingerprint: `f${sequence}`.padEnd(12, '0'),
        bankInstitutionCode: body.bankInstitutionCode ?? null,
        accountNumberMasked: body.accountNumberMasked ?? null,
        status: 'pending_review',
        replacedById: null,
        createdAt: new Date().toISOString(),
      };
      state.qrCodes.push(qr);
      return json(route, 201, qr);
    }

    if (method === 'POST' && path.includes('/pos-terminals')) {
      const branchId = /\/branches\/([^/]+)\/pos-terminals/.exec(path)?.[1] ?? '';
      if (state.posTerminals.some((item) => item.terminalSerial === body.terminalSerial)) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'POS_SERIAL_ALREADY_REGISTERED: el serial ya está activo en la sucursal 1.' },
          }),
        });
      }
      const terminal: PosTerminal = {
        terminalId: next(),
        branchId,
        terminalSerial: body.terminalSerial ?? '',
        terminalAlias: body.terminalAlias ?? null,
        provider: null,
        model: null,
        status: 'registered',
        activatedAt: null,
      };
      state.posTerminals.push(terminal);
      return json(route, 201, terminal);
    }

    if (method === 'PATCH' && path.includes('/pos-terminals/')) {
      const terminalId = path.split('/pos-terminals/')[1] ?? '';
      const terminal = state.posTerminals.find((item) => item.terminalId === terminalId);
      if (terminal) terminal.status = body.status ?? terminal.status;
      return json(route, 200, terminal ?? {});
    }

    if (method === 'POST' && path.endsWith('/submit')) {
      const gaps = gapsOf(state);
      if (gaps.length > 0) {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: `PARTNER_SUBMISSION_INCOMPLETE: faltan ${gaps.map((g) => g.requirement).join(', ')}.` },
          }),
        });
      }
      state.onboardingStatus = 'under_review';
      return json(route, 200, { partnerId: state.partnerId, onboardingStatus: 'under_review' });
    }

    return json(route, 404, {});
  });

  // El binario del QR va DIRECTO al almacenamiento, sin pasar por la API: se intercepta aparte
  // porque es otro origen, y que lo sea es justamente parte del diseño.
  await page.route('https://storage.atlas.test/**', (route) => route.fulfill({ status: 200, body: '' }));

  return state;
}

/** Deja una sesión de comercio en el navegador antes de que la página arranque. */
export async function seedMerchantSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-merchant-token');
    window.localStorage.setItem('atlas_session_kind', 'merchant');
  });
}
