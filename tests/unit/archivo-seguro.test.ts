import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirODescargar, blobInofensivo, esTipoQueSePinta, tipoBase } from '@/lib/archivoSeguro';

afterEach(() => vi.restoreAllMocks());

describe('archivoSeguro (ERP-07: un adjunto no se pinta como página del ERP)', () => {
  it('normaliza el tipo', () => {
    expect(tipoBase('Text/HTML; charset=utf-8')).toBe('text/html');
    expect(tipoBase(null)).toBe('');
  });

  it.each(['application/pdf', 'image/png', 'image/jpeg', 'IMAGE/WEBP', 'image/gif'])('deja pintar %s', (tipo) => {
    expect(esTipoQueSePinta(tipo)).toBe(true);
  });

  it.each(['text/html', 'image/svg+xml', 'application/xml', 'text/xml', 'application/xhtml+xml', '', null, 'application/octet-stream'])(
    'no deja pintar %j',
    (tipo) => {
      expect(esTipoQueSePinta(tipo)).toBe(false);
    },
  );

  it('un HTML o un SVG pierde su tipo; un PDF lo conserva', () => {
    const html = new Blob(['<script>alert(1)</script>'], { type: 'text/html' });
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    expect(blobInofensivo(html).type).toBe('application/octet-stream');
    expect(blobInofensivo(svg).type).toBe('application/octet-stream');
    expect(blobInofensivo(pdf)).toBe(pdf);
    expect(blobInofensivo(html).size).toBe(html.size);
  });

  it('abre en otra pestaña un PDF', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    abrirODescargar('blob:x', 'application/pdf', 'contrato.pdf');
    expect(abrir).toHaveBeenCalledWith('blob:x', '_blank', 'noopener');
  });

  it('descarga con su nombre lo que no se puede pintar', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    abrirODescargar('blob:y', 'text/html', 'pagina.html');
    expect(abrir).not.toHaveBeenCalled();
    expect(clic).toHaveBeenCalledTimes(1);
    const enlace = clic.mock.contexts[0] as HTMLAnchorElement;
    expect(enlace.download).toBe('pagina.html');
    expect(enlace.isConnected).toBe(false);
  });
});
