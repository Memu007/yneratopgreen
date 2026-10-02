"""Que categorias declaran marca, y cual es la lista.

**No se deduce de la anatomia.** `activo` incluye «Tierras y parcelas» y
«Bienes y Ganado», y ni un campo ni un ternero tienen marca. Tampoco alcanza
con «vende cosas fabricadas»: un herbicida tiene marca, pero no es ninguna de
las que hay cargadas, que son de maquinaria. Ofrecer esta lista dentro de
«Insumos agricolas» seria el mismo defecto que ofrecerla para un campo.

Por eso arranca en una sola categoria. Ampliarla a otra es cargar la lista de
esa otra categoria, y es una decision de producto, no un renglon mas aca.

Este modulo decide el valor POR OMISION que escribe la semilla. Lo que manda en
caliente es `categories.usa_marca`, que la clienta edita desde el panel.

Y resuelve «Otra marca»: la que escribe quien publica cuando no esta en la
lista (decision de Emi, 01/10). Se guarda como una opcion mas de la misma
lista, asi que el filtro, la ficha y el alta la tratan igual que a las
cargadas, y las que ya existian no cambian.

Lo que el panel hace con las marcas —corregir el nombre, unir dos, dar de baja
y de alta (decision de Emi, 02/10)— tambien vive aca, con el mismo candado:
unir mientras alguien escribe esa marca no puede dejar una publicacion
apuntando a una marca que ya no existe.
"""
import re
import unicodedata
import uuid
from contextlib import contextmanager
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db.base import SessionLocal
from app.models.form_option import FormOption
from app.models.product import Product, ProductStatus

MARCA_MINIMO = 2
MARCA_MAXIMO = 40

# El candado de las marcas escritas. Dos altas que escriben la misma marca
# nueva a la vez tienen que terminar en UNA: sin el candado, las dos buscan,
# no la encuentran y la crean. La tabla no tiene un indice unico que lo
# impida, y agregarlo exigiria tocar las opciones que ya existen.
CANDADO_DE_MARCAS = 1_010_200_101

# Cuanto espera una marca escrita a que otra suelte el candado. Lo tiene
# apenas lo que tarda en buscar y crear una fila; si pasa de esto, algo anda
# mal, y es mejor un error que esperar para siempre.
ESPERA_DEL_CANDADO = "5s"

# Las marcas de maquinaria que carga la siembra, en su orden: la posicion es
# el `display_order`. La lista vino del buscador que armo la clienta y la curo
# la PM, en dos pasos.
#
# Primero se retiro «Jhon Deere», que es «John Deere» mal escrito y estaba
# junto a el: dos etiquetas para el mismo tractor parten los resultados en dos.
#
# Despues se decidieron los cuatro pares, y NO en bloque:
#
#   Deutz / Deutz-Fahr   quedan los dos: en el usado argentino «Deutz» es
#                        Deutz Argentina y «Deutz-Fahr» la moderna.
#   Case / Case IH       quedan los dos: Case IH existe desde la fusion de
#                        1985, y se distinguen desde la chapa.
#   Fiat / Fiat Someca / Someca  queda «fiat» sola: Someca era el brazo
#                        frances de Fiat y la maquina que esta en el campo es
#                        un Fiat. Tres etiquetas para una familia es «Jhon
#                        Deere» bien escrito.
#   Chery / Chery Bylion queda «chery» a secas: Bylion es la linea de
#                        tractores de Chery, no otro fabricante, y en el
#                        mercado se la nombra «Chery». La PM habia elegido la
#                        etiqueta larga y Emi la corrigio: el conocimiento del
#                        mercado es suyo.
#
# El valor es un slug y la etiqueta es el nombre: el slug es lo que viaja en el
# filtro y queda guardado en la publicacion.
#
# En produccion la siembra no corre: ahi las trae la migracion `01ff14043124`,
# con una copia congelada de esta lista. Cambiar la lista despues tambien pide
# una migracion. Y es lo que el panel usa para decir si una marca «se cargo de
# la lista» o la escribio alguien al publicar.
MARCAS_DE_LA_LISTA = (
    ("agrinar", "Agrinar"),
    ("antonio-carraro", "Antonio Carraro"),
    ("apache", "Apache"),
    ("belarus", "Belarus"),
    ("bronco", "Bronco"),
    ("case", "Case"),
    ("case-ih", "Case IH"),
    ("chery", "Chery"),
    ("claas", "Claas"),
    ("deutz", "Deutz"),
    ("deutz-fahr", "Deutz-Fahr"),
    ("dongfeng", "Dongfeng"),
    ("eisen", "Eisen"),
    ("farmtrac", "Farmtrac"),
    ("ferrari", "Ferrari"),
    ("fiat", "Fiat"),
    ("foton", "Foton"),
    ("grosspal", "Grosspal"),
    ("hanomag", "Hanomag"),
    ("husqvarna", "Husqvarna"),
    ("jinma", "Jinma"),
    ("john-deere", "John Deere"),
    ("kioti", "Kioti"),
    ("kubota", "Kubota"),
    ("lamborghini-trattori", "Lamborghini Trattori"),
    ("landini", "Landini"),
    ("lovol", "Lovol"),
    ("mahindra", "Mahindra"),
    ("massey-ferguson", "Massey Ferguson"),
    ("mccormick", "McCormick"),
    ("new-holland", "New Holland"),
    ("pasquali", "Pasquali"),
    ("pauny", "Pauny"),
    ("roland-h", "Roland H"),
    ("same", "SAME"),
    ("shibaura", "Shibaura"),
    ("sonalika", "Sonalika"),
    ("universal", "Universal"),
    ("valpadana", "Valpadana"),
    ("valtra", "Valtra"),
    ("yanmar", "Yanmar"),
    ("yard-machines", "Yard Machines"),
    ("zanello", "Zanello"),
    ("zoomlion", "Zoomlion"),
)
VALORES_DE_LA_LISTA = frozenset(valor for valor, _ in MARCAS_DE_LA_LISTA)


def _sin_acentos(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii").lower()


def orden_de_marca(opcion: FormOption):
    """Donde va una marca en la lista: su orden, y a igual orden, su nombre.

    El nombre se compara sin mayusculas ni acentos, y en Python, no en la
    base: la base local ordena bytes («Zeta» antes que «agromec») y la de
    produccion puede no hacerlo, y una marca escrita en minuscula tiene que
    caer en el mismo lugar en las dos.
    """
    return (opcion.display_order or 0, _sin_acentos(opcion.label))


def clave_de_marca(texto: str) -> str:
    """Lo que hace iguales a dos marcas: sin mayusculas, acentos ni espacios.

    Tambien sin guiones ni puntos: «Deutz-Fahr» y «Deutz Fahr», o «John
    Deere» y «johndeere», son la misma marca escrita de dos formas.
    """
    return re.sub(r"[^a-z0-9]", "", _sin_acentos(texto))


def limpiar_marca(texto: str) -> str:
    """El nombre como se escribio, sin espacios de mas."""
    return " ".join(texto.split())


def marca_escrita(nombre: str) -> str:
    """El `value` de la marca escrita: la que ya existe, o una nueva.

    Si coincide con una de la lista —activa o no— se usa esa y no se crea
    otra. Una dada de baja no se reactiva desde un alta: se rechaza, como se
    rechaza elegirla de la lista.

    Si es nueva, entra a la lista con el nombre como se escribio, en su lugar
    alfabetico y sin mover a las demas: toma el orden de la que le sigue, y el
    empate se resuelve por nombre, que es como se ordena la lista.

    **Se resuelve en una transaccion propia, corta, y se confirma aca.** El
    candado no puede vivir en la transaccion de la publicacion. Medido: una
    alta con «Otra marca» que despues fallaba por otro dato lo dejaba tomado
    hasta cerrar su sesion, y otra alta con «Otra marca» lo esperaba sin
    soltar el proceso —las rutas son `async` y la base se llama sin `await`—,
    asi que la sesion de la primera nunca se cerraba: la API entera dejaba de
    responder. Por eso quien llama la resuelve despues de validar todo lo
    demas, y una alta rechazada no deja su marca.
    """
    nombre = limpiar_marca(nombre)
    clave = clave_de_marca(nombre)
    db = SessionLocal()
    try:
        with candado_de_marcas(db):
            return _buscar_o_crear(db, nombre, clave)
    finally:
        db.close()


@contextmanager
def candado_de_marcas(db: Session):
    """La transaccion de `db`, con el candado de las marcas tomado.

    Al salir confirma; si algo falla adentro, deshace en el momento y suelta el
    candado, sin esperar a que se cierre la sesion. Un error con el candado
    tomado hasta el cierre de la sesion fue lo que congelaba la API.
    """
    try:
        db.execute(text(f"SET LOCAL lock_timeout = '{ESPERA_DEL_CANDADO}'"))
        db.execute(text("SELECT pg_advisory_xact_lock(:candado)"), {"candado": CANDADO_DE_MARCAS})
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la marca en este momento. Probá de nuevo.",
        )
    try:
        yield
        db.commit()
    except BaseException:
        db.rollback()
        raise


def _orden_alfabetico(opciones, nombre: str, excepto: Optional[str] = None) -> int:
    """El `display_order` que pone a `nombre` en su lugar alfabetico.

    Toma el de la marca activa que le sigue, sin mover a las demas; el empate
    se resuelve por nombre, que es como se ordena la lista. Si no le sigue
    ninguna, va al final.
    """
    otras = [opcion for opcion in opciones if opcion.id != excepto]
    activas = sorted((opcion for opcion in otras if opcion.is_active), key=orden_de_marca)
    siguiente = next(
        (opcion for opcion in activas if _sin_acentos(opcion.label) > _sin_acentos(nombre)),
        None,
    )
    if siguiente is not None:
        return siguiente.display_order or 0
    return max((opcion.display_order or 0 for opcion in otras), default=-1) + 1


def _buscar_o_crear(db, nombre: str, clave: str) -> str:
    """La que coincide, o una nueva; con el candado ya tomado."""
    opciones = db.query(FormOption).filter(FormOption.option_type == "brand").all()
    for opcion in opciones:
        if clave in (clave_de_marca(opcion.label), clave_de_marca(opcion.value)):
            if not opcion.is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"La marca «{opcion.label}» no está disponible. Elegí otra.",
                )
            return opcion.value

    valor = re.sub(r"[^a-z0-9]+", "-", _sin_acentos(nombre)).strip("-")
    usados = {opcion.value for opcion in opciones}
    base, numero = valor, 2
    while valor in usados:
        valor, numero = f"{base}-{numero}", numero + 1

    db.add(FormOption(
        id=str(uuid.uuid4()),
        option_type="brand",
        value=valor,
        label=nombre,
        display_order=_orden_alfabetico(opciones, nombre),
        is_active=True,
    ))
    return valor


# === El panel ================================================================

def _todas(db: Session) -> List[FormOption]:
    return db.query(FormOption).filter(FormOption.option_type == "brand").all()


def publicaciones_por_marca(db: Session) -> Dict[str, int]:
    """Cuantas publicaciones usa cada marca, sin contar las eliminadas.

    Las eliminadas no las ve nadie: quien vende ya no las encuentra, y decir
    que una marca «tiene 3» contando esas seria prometer algo que no esta.
    """
    return dict(
        db.query(Product.brand, func.count(Product.id))
        .filter(Product.brand.isnot(None), Product.status != ProductStatus.DELETED)
        .group_by(Product.brand)
        .all()
    )


def para_el_panel(opcion: FormOption, cuantas: Dict[str, int]) -> dict:
    return {
        "id": str(opcion.id),
        "value": opcion.value,
        "label": opcion.label,
        "is_active": bool(opcion.is_active),
        "publicaciones": cuantas.get(opcion.value, 0),
        "de_la_lista": opcion.value in VALORES_DE_LA_LISTA,
    }


def listar_para_el_panel(db: Session) -> List[dict]:
    """Todas, tambien las dadas de baja, en el orden del alta."""
    cuantas = publicaciones_por_marca(db)
    return [para_el_panel(opcion, cuantas) for opcion in sorted(_todas(db), key=orden_de_marca)]


def _la_marca(opciones, opcion_id: str) -> FormOption:
    opcion = next((opcion for opcion in opciones if str(opcion.id) == opcion_id), None)
    if opcion is None:
        raise HTTPException(
            status_code=404,
            detail="Esa marca ya no existe. Puede que se haya unido a otra.",
        )
    return opcion


def corregir_nombre(db: Session, opcion_id: str, nombre: str) -> dict:
    """El nombre nuevo, si no es el de otra marca.

    Si sin mayusculas, acentos ni espacios es el de otra, no se pisa: responde
    409 con esa otra, para que el panel ofrezca unirlas. El valor interno no
    cambia —es lo que quedo guardado en las publicaciones—, y la marca toma su
    lugar alfabetico con el nombre nuevo.
    """
    nombre = limpiar_marca(nombre)
    with candado_de_marcas(db):
        opciones = _todas(db)
        opcion = _la_marca(opciones, opcion_id)
        clave = clave_de_marca(nombre)
        otra = next(
            (o for o in opciones
             if o.id != opcion.id and clave in (clave_de_marca(o.label), clave_de_marca(o.value))),
            None,
        )
        if otra is not None:
            raise HTTPException(status_code=409, detail={
                "mensaje": f"Ya existe la marca «{otra.label}». Podés unirlas.",
                "otra": para_el_panel(otra, publicaciones_por_marca(db)),
            })
        opcion.label = nombre
        opcion.display_order = _orden_alfabetico(opciones, nombre, excepto=opcion.id)
    return para_el_panel(opcion, publicaciones_por_marca(db))


def cambiar_estado(db: Session, opcion_id: str, activa: bool) -> dict:
    """Dar de baja o de alta. Las publicaciones que la tienen no cambian."""
    with candado_de_marcas(db):
        opcion = _la_marca(_todas(db), opcion_id)
        opcion.is_active = activa
    return para_el_panel(opcion, publicaciones_por_marca(db))


def unir(db: Session, origen_id: str, destino_id: str) -> dict:
    """Las publicaciones de `origen` pasan a `destino`, y `origen` desaparece.

    Se mueven todas, tambien las pausadas y las eliminadas: ninguna puede
    quedar apuntando a una marca que ya no existe. Lo que se informa son las
    que no estan eliminadas, que es lo que el panel cuenta.
    """
    if origen_id == destino_id:
        raise HTTPException(status_code=400, detail="Una marca no se puede unir consigo misma.")
    with candado_de_marcas(db):
        opciones = _todas(db)
        origen = _la_marca(opciones, origen_id)
        destino = _la_marca(opciones, destino_id)
        if not destino.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"«{destino.label}» está dada de baja. Dala de alta antes de unirle otra.",
            )
        visibles = publicaciones_por_marca(db).get(origen.value, 0)
        db.query(Product).filter(Product.brand == origen.value).update(
            {Product.brand: destino.value}, synchronize_session=False,
        )
        db.delete(origen)
    return {"movidas": visibles, "destino": para_el_panel(destino, publicaciones_por_marca(db))}


CATEGORIAS_CON_MARCA = frozenset({
    "maquinaria-agricola",
})


def usa_marca_por_categoria(
    slug_de_categoria: Optional[str],
    categoria_es_servicio: bool,
) -> bool:
    """¿Esta categoria ofrece marca?

    Una categoria de servicio no la ofrece nunca: un asesoramiento no tiene
    marca. Se comprueba aunque hoy ninguna figure en la lista, porque la lista
    se edita y un error ahi no puede convertir un servicio en una maquina.
    """
    if categoria_es_servicio:
        return False
    return slug_de_categoria in CATEGORIAS_CON_MARCA
