#!/usr/bin/env python3
"""
Comprueba que un QR generado por el portal SE LEE, y que dice lo que debe decir.

El generador de `lib/qr.ts` no tiene dependencias, asi que nadie mas garantiza que su salida sea un
QR valido: un error en la correccion Reed-Solomon o en la mascara produce un cuadro que se ve
perfecto y que ningun telefono descifra. Esto pasa la imagen por el lector de codigos del sistema
—el mismo motor que usa la camara de macOS— y compara el texto devuelto con el esperado.

Uso: python3 scripts/verificar-qr.py <imagen.png> <texto esperado>
"""
import sys

try:
    from Quartz import CIDetector, CIImage
    from Foundation import NSURL
except ImportError:  # pragma: no cover - depende del entorno, no del codigo
    print("Falta pyobjc (Quartz); no se puede verificar el QR en esta maquina.", file=sys.stderr)
    raise SystemExit(2)


def leer(path: str) -> str | None:
    imagen = CIImage.imageWithContentsOfURL_(NSURL.fileURLWithPath_(path))
    if imagen is None:
        return None
    detector = CIDetector.detectorOfType_context_options_(
        "CIDetectorTypeQRCode", None, {"CIDetectorAccuracy": "CIDetectorAccuracyHigh"}
    )
    rasgos = detector.featuresInImage_(imagen)
    return rasgos[0].messageString() if rasgos else None


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path, esperado = sys.argv[1], sys.argv[2]
    leido = leer(path)
    if leido is None:
        print(f"FALLA: {path} no se pudo leer como QR.")
        return 1
    if leido != esperado:
        print(f"FALLA: {path} dice {leido!r} y se esperaba {esperado!r}.")
        return 1
    print(f"OK: {path} se lee y dice {leido!r}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
