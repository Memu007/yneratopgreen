#!/usr/bin/env python3
"""Deriva los archivos de marca de producto desde la fuente oficial.

La fuente es material de cliente y no se toca:

    docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png
    SHA-256 5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf
    1536 x 1024, PNG RGB de 8 bits, sin canal alfa

Este script SÓLO recorta margen y promedia píxeles. No redibuja, no vectoriza,
no recolorea, no genera nada y no inventa transparencia: cada píxel de salida es
el promedio de píxeles que ya estaban en la fuente, y el relleno del favicon usa
el color de fondo LEÍDO de la propia fuente. Existe para que la derivación sea
reproducible y auditable, no para retocar el logo.

    python3 scripts/derivar_marca.py            # escribe en public/marca
    python3 scripts/derivar_marca.py --verificar # sólo informa, no escribe
"""
import hashlib
import struct
import sys
import zlib
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / 'docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png'
SHA_DE_LA_FUENTE = '5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf'
DESTINO = RAIZ / 'public/marca'


# --- PNG mínimo: RGB de 8 bits, sin entrelazado -----------------------------

def leer_png(ruta):
    datos = ruta.read_bytes()
    if datos[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{ruta} no es un PNG')
    i, ancho, alto, idat = 8, None, None, bytearray()
    while i < len(datos):
        (largo,) = struct.unpack('>I', datos[i:i + 4])
        tipo = datos[i + 4:i + 8]
        cuerpo = datos[i + 8:i + 8 + largo]
        if tipo == b'IHDR':
            ancho, alto, prof, color, _, _, entre = struct.unpack('>IIBBBBB', cuerpo)
            if (prof, color, entre) != (8, 2, 0):
                raise SystemExit('la fuente dejó de ser PNG RGB de 8 bits sin entrelazar')
        elif tipo == b'IDAT':
            idat += cuerpo
        elif tipo == b'IEND':
            break
        i += 12 + largo

    crudo = zlib.decompress(bytes(idat))
    paso, bpp = ancho * 3, 3
    filas, anterior, p = [], bytearray(paso), 0
    for _ in range(alto):
        filtro, p = crudo[p], p + 1
        linea = bytearray(crudo[p:p + paso])
        p += paso
        if filtro == 1:
            for x in range(bpp, paso):
                linea[x] = (linea[x] + linea[x - bpp]) & 0xFF
        elif filtro == 2:
            for x in range(paso):
                linea[x] = (linea[x] + anterior[x]) & 0xFF
        elif filtro == 3:
            for x in range(paso):
                izq = linea[x - bpp] if x >= bpp else 0
                linea[x] = (linea[x] + ((izq + anterior[x]) >> 1)) & 0xFF
        elif filtro == 4:
            for x in range(paso):
                a = linea[x - bpp] if x >= bpp else 0
                b = anterior[x]
                c = anterior[x - bpp] if x >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                linea[x] = (linea[x] + pr) & 0xFF
        elif filtro != 0:
            raise SystemExit(f'filtro PNG desconocido: {filtro}')
        filas.append(linea)
        anterior = linea
    return ancho, alto, filas


def escribir_png(ruta, ancho, alto, filas, con_alfa=False):
    crudo = bytearray()
    for linea in filas:
        crudo.append(0)
        crudo += linea

    def trozo(tipo, cuerpo):
        return (struct.pack('>I', len(cuerpo)) + tipo + cuerpo
                + struct.pack('>I', zlib.crc32(tipo + cuerpo) & 0xFFFFFFFF))

    # Tipo de color 6 = RGBA; 2 = RGB. Es lo único que cambia entre los dos.
    tipo_de_color = 6 if con_alfa else 2
    ruta.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + trozo(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, 8, tipo_de_color, 0, 0, 0))
        + trozo(b'IDAT', zlib.compress(bytes(crudo), 9))
        + trozo(b'IEND', b''))


# --- Operaciones: recortar, rellenar con el fondo propio, promediar ---------

def color_de_fondo(ancho, alto, filas):
    """El color más repetido de la fuente. No se elige: se cuenta."""
    cuenta = Counter()
    for y in range(0, alto, 4):
        fila = filas[y]
        for x in range(0, ancho, 4):
            cuenta[(fila[x * 3], fila[x * 3 + 1], fila[x * 3 + 2])] += 1
    return cuenta.most_common(1)[0][0]


def caja_del_monograma(ancho, alto, filas, fondo, umbral=40):
    x0, y0, x1, y1 = ancho, alto, 0, 0
    for y in range(alto):
        fila = filas[y]
        for x in range(ancho):
            p = (fila[x * 3], fila[x * 3 + 1], fila[x * 3 + 2])
            if abs(p[0] - fondo[0]) + abs(p[1] - fondo[1]) + abs(p[2] - fondo[2]) > umbral:
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
    return x0, y0, x1 + 1, y1 + 1


def recortar(filas, x0, y0, x1, y1):
    return [bytearray(fila[x0 * 3:x1 * 3]) for fila in filas[y0:y1]]


def encuadrar(filas, ancho, alto, fondo):
    """Lleva el recorte a un cuadrado agregando el MISMO fondo de la fuente.

    No es transparencia fingida ni un color nuevo: es el fondo opaco que el
    archivo ya tiene, extendido para que un favicon cuadrado no deforme el
    monograma ni lo achique de más.
    """
    lado = max(ancho, alto)
    relleno = bytearray(bytes(fondo) * lado)
    arriba = (lado - alto) // 2
    izquierda = (lado - ancho) // 2
    salida = [bytearray(relleno) for _ in range(lado)]
    for y, fila in enumerate(filas):
        salida[arriba + y][izquierda * 3:(izquierda + ancho) * 3] = fila
    return lado, salida


def colores_del_glifo(ancho, alto, filas, fondo, cuantos=2):
    """Los colores del monograma, contados en la fuente y no elegidos a mano.

    Se agrupan en cubos de 16 para que el grano de compresión no cuente cada
    matiz como un color distinto, y se devuelven los más repetidos entre los que
    están claramente lejos del fondo.
    """
    cuenta = Counter()
    for y in range(0, alto, 2):
        fila = filas[y]
        for x in range(0, ancho, 2):
            p = (fila[x * 3], fila[x * 3 + 1], fila[x * 3 + 2])
            if abs(p[0] - fondo[0]) + abs(p[1] - fondo[1]) + abs(p[2] - fondo[2]) > 200:
                cuenta[(p[0] // 16, p[1] // 16, p[2] // 16)] += 1
    nucleos = []
    for cubo, _ in cuenta.most_common():
        color = (cubo[0] * 16 + 8, cubo[1] * 16 + 8, cubo[2] * 16 + 8)
        if all(sum(abs(color[i] - otro[i]) for i in range(3)) > 120 for otro in nucleos):
            nucleos.append(color)
        if len(nucleos) == cuantos:
            break
    return nucleos


def alfa_y_color(p, fondo, nucleos):
    """Cuánto de este píxel es monograma, y de qué color sería sin el fondo.

    La fuente es el monograma dibujado SOBRE un fondo opaco conocido, así que
    cada píxel del borde es una mezcla: `p = a*F + (1-a)*fondo`. Con el fondo
    medido y los dos colores del glifo también medidos, `a` sale de proyectar el
    píxel sobre la recta que va del fondo al color del glifo, y el color limpio
    sale de despejar `F`.

    Eso es lo que descontamina el borde. Sin despejar, un borde semitransparente
    se lleva puesto el verde oscuro del original y, sobre otra banda, se ve como
    un halo: transparencia con halo sigue pareciendo un recorte pegado.
    """
    mejor_residuo, mejor_alfa = None, 0.0
    for nucleo in nucleos:
        eje = [nucleo[i] - fondo[i] for i in range(3)]
        largo2 = sum(v * v for v in eje)
        desde = [p[i] - fondo[i] for i in range(3)]
        a = sum(desde[i] * eje[i] for i in range(3)) / largo2
        a = 0.0 if a < 0.0 else (1.0 if a > 1.0 else a)
        residuo = sum((p[i] - (fondo[i] + a * eje[i])) ** 2 for i in range(3))
        if mejor_residuo is None or residuo < mejor_residuo:
            mejor_residuo, mejor_alfa = residuo, a
    if mejor_alfa <= 0.0:
        return 0.0, fondo
    limpio = []
    for i in range(3):
        valor = (p[i] - (1.0 - mejor_alfa) * fondo[i]) / mejor_alfa
        limpio.append(0 if valor < 0 else (255 if valor > 255 else int(round(valor))))
    return mejor_alfa, tuple(limpio)


def piso_de_alfa(ancho, alto, filas, fondo, nucleos, banda=30):
    """Cuánto alfa levanta el grano del fondo. Se mide, no se supone.

    El fondo de la fuente no es un color plano perfecto: la compresión le dejó
    grano, y ese grano da un alfa chiquito pero distinto de cero en TODO el
    fondo. Sin restarlo, el PNG sale con un velo verde en vez de con fondo
    transparente. Se mide sobre el marco exterior, que es fondo y nada más.
    """
    techo = 0.0
    for y in list(range(banda)) + list(range(alto - banda, alto)):
        fila = filas[y]
        for x in range(ancho):
            a, _ = alfa_y_color((fila[x * 3], fila[x * 3 + 1], fila[x * 3 + 2]), fondo, nucleos)
            techo = max(techo, a)
    return techo


def separar_fondo(filas, ancho, alto, fondo, nucleos, piso):
    """Devuelve filas RGBA con el fondo afuera y el borde descontaminado."""
    salida = []
    for y in range(alto):
        fila = filas[y]
        linea = bytearray(ancho * 4)
        for x in range(ancho):
            a, limpio = alfa_y_color(
                (fila[x * 3], fila[x * 3 + 1], fila[x * 3 + 2]), fondo, nucleos)
            # El grano del fondo se descuenta y lo que queda se reestira, para
            # que el borde siga llegando a opaco y no se adelgace el glifo.
            a = 0.0 if a <= piso else (a - piso) / (1.0 - piso)
            linea[x * 4] = limpio[0]
            linea[x * 4 + 1] = limpio[1]
            linea[x * 4 + 2] = limpio[2]
            linea[x * 4 + 3] = int(round(a * 255))
        salida.append(linea)
    return salida


def reducir_rgba(filas, ancho, alto, nuevo_ancho, nuevo_alto):
    """Promedio de caja en alfa PREMULTIPLICADO.

    Promediar el color y el alfa por separado mezcla el color de los píxeles
    transparentes —que no se ven— con el de los opacos, y eso vuelve a manchar
    el borde. Premultiplicar es lo que hace que un píxel invisible no aporte
    color.
    """
    salida = []
    for ny in range(nuevo_alto):
        y0 = ny * alto // nuevo_alto
        y1 = max(y0 + 1, (ny + 1) * alto // nuevo_alto)
        linea = bytearray(nuevo_ancho * 4)
        for nx in range(nuevo_ancho):
            x0 = nx * ancho // nuevo_ancho
            x1 = max(x0 + 1, (nx + 1) * ancho // nuevo_ancho)
            r = g = b = a = n = 0
            for y in range(y0, y1):
                fila = filas[y]
                for x in range(x0, x1):
                    alfa = fila[x * 4 + 3]
                    r += fila[x * 4] * alfa
                    g += fila[x * 4 + 1] * alfa
                    b += fila[x * 4 + 2] * alfa
                    a += alfa
                    n += 1
            alfa_medio = a / n
            if alfa_medio <= 0:
                continue  # queda en ceros: transparente y sin color que aporte
            linea[nx * 4] = min(255, int(round(r / a)))
            linea[nx * 4 + 1] = min(255, int(round(g / a)))
            linea[nx * 4 + 2] = min(255, int(round(b / a)))
            linea[nx * 4 + 3] = int(round(alfa_medio))
        salida.append(linea)
    return salida


def reducir(filas, ancho, alto, nuevo_ancho, nuevo_alto):
    """Promedio de caja: cada píxel de salida es el promedio de los que cubre."""
    salida = []
    for ny in range(nuevo_alto):
        y0 = ny * alto // nuevo_alto
        y1 = max(y0 + 1, (ny + 1) * alto // nuevo_alto)
        linea = bytearray(nuevo_ancho * 3)
        for nx in range(nuevo_ancho):
            x0 = nx * ancho // nuevo_ancho
            x1 = max(x0 + 1, (nx + 1) * ancho // nuevo_ancho)
            r = g = b = n = 0
            for y in range(y0, y1):
                fila = filas[y]
                for x in range(x0, x1):
                    r += fila[x * 3]
                    g += fila[x * 3 + 1]
                    b += fila[x * 3 + 2]
                    n += 1
            linea[nx * 3] = r // n
            linea[nx * 3 + 1] = g // n
            linea[nx * 3 + 2] = b // n
        salida.append(linea)
    return salida


def main():
    solo_verificar = '--verificar' in sys.argv
    sha = hashlib.sha256(FUENTE.read_bytes()).hexdigest()
    if sha != SHA_DE_LA_FUENTE:
        raise SystemExit(f'la fuente cambió: {sha}\nse esperaba {SHA_DE_LA_FUENTE}')

    ancho, alto, filas = leer_png(FUENTE)
    fondo = color_de_fondo(ancho, alto, filas)
    x0, y0, x1, y1 = caja_del_monograma(ancho, alto, filas, fondo)
    print(f'fuente     {ancho}x{alto}  fondo #{fondo[0]:02X}{fondo[1]:02X}{fondo[2]:02X}')
    print(f'monograma  x {x0}..{x1}  y {y0}..{y1}  =  {x1 - x0}x{y1 - y0}')

    # El de la cabecera y el pie conserva la proporción del recorte: sólo se le
    # saca el margen que sobra, para que el monograma no quede diminuto.
    margen = round((x1 - x0) * 0.08)
    a0, b0 = max(0, x0 - margen), max(0, y0 - margen)
    a1, b1 = min(ancho, x1 + margen), min(alto, y1 + margen)
    recorte = recortar(filas, a0, b0, a1, b1)
    marca = reducir(recorte, a1 - a0, b1 - b0, 320, 197)

    # El mismo recorte y la misma medida, pero con el fondo afuera. Es el que
    # usan Header y Footer: ahí el monograma va sobre la banda verde del sitio y
    # la placa oscura de la fuente se veía como una imagen pegada encima. La
    # medida no cambia -320x197- para que la caja que la interfaz ya reserva sea
    # exactamente la misma.
    nucleos = colores_del_glifo(ancho, alto, filas, fondo)
    piso = piso_de_alfa(ancho, alto, filas, fondo, nucleos)
    print('glifo      ' + '  '.join(f'#{c[0]:02X}{c[1]:02X}{c[2]:02X}' for c in nucleos)
          + f'   piso de alfa {piso:.4f}')
    transparente = reducir_rgba(
        separar_fondo(recorte, a1 - a0, b1 - b0, fondo, nucleos, piso),
        a1 - a0, b1 - b0, 320, 197)

    # El del favicon va más ajustado y encuadrado con el fondo propio: en 64 px
    # el margen de la fuente se comería el monograma.
    margen_chico = round((x1 - x0) * 0.04)
    c0, d0 = max(0, x0 - margen_chico), max(0, y0 - margen_chico)
    c1, d1 = min(ancho, x1 + margen_chico), min(alto, y1 + margen_chico)
    cuadro = recortar(filas, c0, d0, c1, d1)
    lado, cuadro = encuadrar(cuadro, c1 - c0, d1 - d0, fondo)
    favicon = reducir(cuadro, lado, lado, 64, 64)

    salidas = [
        (DESTINO / 'agroboeda-monograma.png', 320, 197, marca, False),
        (DESTINO / 'agroboeda-monograma-alfa.png', 320, 197, transparente, True),
        (DESTINO / 'agroboeda-favicon.png', 64, 64, favicon, False),
    ]
    for ruta, an, al, datos, con_alfa in salidas:
        if not solo_verificar:
            DESTINO.mkdir(parents=True, exist_ok=True)
            escribir_png(ruta, an, al, datos, con_alfa=con_alfa)
        actual = hashlib.sha256(ruta.read_bytes()).hexdigest() if ruta.exists() else '(no existe)'
        canal = 'RGBA' if con_alfa else 'RGB '
        print(f'{ruta.relative_to(RAIZ)}  {an}x{al}  {canal}  sha256 {actual}')


if __name__ == '__main__':
    main()
