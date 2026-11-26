from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models.archivo_portafolio import ArchivoPortafolio
from models.archivo_entrega import ArchivoEntrega
from models.carpeta_portafolio import CarpetaAprendiz
from models.entrega import Entrega
from models.tarea import Tarea
from models.usuario import Usuario
from schemas.portafolio import (
    CarpetaPortafolio,
    SubcarpetaPortafolio,
    ArchivoPortafolioResponse,
    CarpetaAprendizResponse,
)

# Único lugar donde se define la lista de carpetas fijas del portafolio del
# aprendiz. La clave ("categoria") es lo que se guarda en la BD; el valor
# es el nombre que ve el usuario.
CARPETAS_PORTAFOLIO = {
    "planes_mejoramiento": "Planes de mejoramiento",
    "etapa_productiva": "Formato etapa productiva",
    "evidencias_aprendizaje": "Evidencias de aprendizaje",
    "plan_trabajo_concertado": "Plan de trabajo concertado",
    "otros": "Otros",
}

# Subcarpetas fijas dentro de CADA carpeta anterior (mismo esquema de
# trimestre para las 5). La clave ("subcarpeta") es lo que se guarda en
# la BD; el valor es el nombre que ve el usuario.
SUBCARPETAS_PORTAFOLIO = {
    "trim_1": "TRIM_I",
    "trim_2": "TRIM_II",
    "trim_3": "TRIM_III",
    "trim_4": "TRIM_IV",
}

MAX_LARGO_NOMBRE_CARPETA = 100


class PortafolioService:
    def __init__(self, db: Session):
        self.db = db

    def _verificar_categoria(self, categoria: str) -> str:
        if categoria not in CARPETAS_PORTAFOLIO:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esa carpeta de portafolio no existe.",
            )
        return categoria

    def _verificar_subcarpeta(self, subcarpeta: str) -> str:
        if subcarpeta not in SUBCARPETAS_PORTAFOLIO:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esa subcarpeta no existe.",
            )
        return subcarpeta

    def obtener_carpetas(self, aprendiz: Usuario) -> list[CarpetaPortafolio]:
        resultado = []
        for categoria, nombre in CARPETAS_PORTAFOLIO.items():
            archivos = (
                self.db.query(ArchivoPortafolio)
                .filter(
                    ArchivoPortafolio.id_aprendiz == aprendiz.id_usuario,
                    ArchivoPortafolio.categoria == categoria,
                )
                .order_by(ArchivoPortafolio.fecha_subida.desc())
                .all()
            )
            resultado.append(
                CarpetaPortafolio(
                    categoria=categoria,
                    nombre=nombre,
                    total_archivos=len(archivos),
                    ultima_modificacion=archivos[0].fecha_subida if archivos else None,
                )
            )
        return resultado

    def obtener_subcarpetas(self, categoria: str, aprendiz: Usuario) -> list[SubcarpetaPortafolio]:
        self._verificar_categoria(categoria)
        resultado = []
        for subcarpeta, nombre in SUBCARPETAS_PORTAFOLIO.items():
            # Cuenta todos los archivos del trimestre, sueltos o dentro de
            # una carpeta creada por el aprendiz.
            archivos = (
                self.db.query(ArchivoPortafolio)
                .filter(
                    ArchivoPortafolio.id_aprendiz == aprendiz.id_usuario,
                    ArchivoPortafolio.categoria == categoria,
                    ArchivoPortafolio.subcarpeta == subcarpeta,
                )
                .order_by(ArchivoPortafolio.fecha_subida.desc())
                .all()
            )
            resultado.append(
                SubcarpetaPortafolio(
                    subcarpeta=subcarpeta,
                    nombre=nombre,
                    total_archivos=len(archivos),
                    ultima_modificacion=archivos[0].fecha_subida if archivos else None,
                )
            )
        return resultado

    def obtener_archivos_de_subcarpeta(
        self, categoria: str, subcarpeta: str, aprendiz: Usuario
    ) -> list[ArchivoPortafolioResponse]:
        self._verificar_categoria(categoria)
        self._verificar_subcarpeta(subcarpeta)
        # Solo los archivos sueltos en el trimestre (id_carpeta vacío).
        archivos = (
            self.db.query(ArchivoPortafolio)
            .filter(
                ArchivoPortafolio.id_aprendiz == aprendiz.id_usuario,
                ArchivoPortafolio.categoria == categoria,
                ArchivoPortafolio.subcarpeta == subcarpeta,
                ArchivoPortafolio.id_carpeta.is_(None),
            )
            .order_by(ArchivoPortafolio.fecha_subida.desc())
            .all()
        )
        return archivos

    def obtener_carpetas_de_subcarpeta(
        self, categoria: str, subcarpeta: str, aprendiz: Usuario
    ) -> list[CarpetaAprendizResponse]:
        self._verificar_categoria(categoria)
        self._verificar_subcarpeta(subcarpeta)
        carpetas = (
            self.db.query(CarpetaAprendiz)
            .filter(
                CarpetaAprendiz.id_aprendiz == aprendiz.id_usuario,
                CarpetaAprendiz.categoria == categoria,
                CarpetaAprendiz.subcarpeta == subcarpeta,
            )
            .order_by(CarpetaAprendiz.nombre.asc())
            .all()
        )
        resultado = []
        for carpeta in carpetas:
            archivos = (
                self.db.query(ArchivoPortafolio)
                .filter(ArchivoPortafolio.id_carpeta == carpeta.id_carpeta)
                .order_by(ArchivoPortafolio.fecha_subida.desc())
                .all()
            )
            resultado.append(
                CarpetaAprendizResponse(
                    id_carpeta=carpeta.id_carpeta,
                    nombre=carpeta.nombre,
                    total_archivos=len(archivos),
                    ultima_modificacion=archivos[0].fecha_subida if archivos else carpeta.fecha_creacion,
                )
            )
        return resultado

    def crear_carpeta(
        self, categoria: str, subcarpeta: str, nombre: str, aprendiz: Usuario
    ) -> CarpetaAprendizResponse:
        self._verificar_categoria(categoria)
        self._verificar_subcarpeta(subcarpeta)

        nombre = (nombre or "").strip()
        if not nombre:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de la carpeta no puede estar vacío.",
            )
        if len(nombre) > MAX_LARGO_NOMBRE_CARPETA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El nombre no puede superar {MAX_LARGO_NOMBRE_CARPETA} caracteres.",
            )

        repetida = (
            self.db.query(CarpetaAprendiz)
            .filter(
                CarpetaAprendiz.id_aprendiz == aprendiz.id_usuario,
                CarpetaAprendiz.categoria == categoria,
                CarpetaAprendiz.subcarpeta == subcarpeta,
                func.lower(CarpetaAprendiz.nombre) == nombre.lower(),
            )
            .first()
        )
        if repetida:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya tienes una carpeta con ese nombre aquí.",
            )

        nueva = CarpetaAprendiz(
            categoria=categoria,
            subcarpeta=subcarpeta,
            nombre=nombre,
            id_aprendiz=aprendiz.id_usuario,
        )
        self.db.add(nueva)
        self.db.commit()
        self.db.refresh(nueva)
        return CarpetaAprendizResponse(
            id_carpeta=nueva.id_carpeta,
            nombre=nueva.nombre,
            total_archivos=0,
            ultima_modificacion=nueva.fecha_creacion,
        )

    # ------------------------------------------------------------------
    # Vínculo Portafolio -> Entrega de una tarea
    # ------------------------------------------------------------------

    def obtener_tareas_disponibles(self, aprendiz: Usuario) -> list[dict]:
        """Tareas entre las que el aprendiz puede elegir al subir un archivo:
        las de su ficha. Si no tiene ficha, la lista sale vacía (y la subida
        sigue funcionando sin vincular a ninguna tarea)."""
        if aprendiz.id_ficha is None:
            return []
        tareas = (
            self.db.query(Tarea)
            .filter(Tarea.id_ficha == aprendiz.id_ficha)
            .order_by(Tarea.fecha_limite.is_(None), Tarea.fecha_limite.asc(), Tarea.id_tarea.desc())
            .all()
        )
        return [
            {
                "id_tarea": t.id_tarea,
                "titulo": t.titulo,
                "competencia": t.competencia.nombre if t.competencia else None,
                "trimestre": t.competencia.trimestre if t.competencia else None,
                "fecha_limite": t.fecha_limite,
            }
            for t in tareas
        ]

    def _vincular_a_tarea(self, id_tarea: int, nombre_archivo: str, url: str, aprendiz: Usuario) -> None:
        """Registra el archivo como adjunto de la Entrega del aprendiz para
        esa tarea (la crea si todavía no existe). NO hace commit: lo hace
        quien la llama, para que el archivo del portafolio y el de la
        entrega se guarden juntos o no se guarde ninguno."""
        tarea = None
        if aprendiz.id_ficha is not None:
            tarea = (
                self.db.query(Tarea)
                .filter(Tarea.id_tarea == id_tarea, Tarea.id_ficha == aprendiz.id_ficha)
                .first()
            )
        if not tarea:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esa tarea no existe o no es de tu ficha.",
            )

        entrega = (
            self.db.query(Entrega)
            .filter(Entrega.id_tarea == id_tarea, Entrega.id_aprendiz == aprendiz.id_usuario)
            .first()
        )
        if not entrega:
            entrega = Entrega(id_tarea=id_tarea, id_aprendiz=aprendiz.id_usuario, estado="pendiente")
            self.db.add(entrega)
            self.db.flush()  # para tener id_entrega

        self.db.add(ArchivoEntrega(nombre_archivo=nombre_archivo, url=url, id_entrega=entrega.id_entrega))

        # Compatibilidad: el campo viejo Entrega.archivo_url se llena con el
        # primer archivo, por si alguna pantalla todavía lo lee.
        if not entrega.archivo_url:
            entrega.archivo_url = url
        entrega.fecha_entrega = datetime.now(timezone.utc)
        # Solo pasa a "en revisión" si estaba pendiente; si el instructor ya
        # la calificó (aprobada / desaprobada) no se toca el estado.
        if entrega.estado == "pendiente":
            entrega.estado = "en_revision"

    def agregar_archivo(
        self,
        categoria: str,
        subcarpeta: str,
        nombre_archivo: str,
        url: str,
        aprendiz: Usuario,
        id_tarea: int | None = None,
    ) -> ArchivoPortafolio:
        self._verificar_categoria(categoria)
        self._verificar_subcarpeta(subcarpeta)
        if id_tarea is not None:
            self._vincular_a_tarea(id_tarea, nombre_archivo, url, aprendiz)
        nuevo = ArchivoPortafolio(
            categoria=categoria,
            subcarpeta=subcarpeta,
            nombre_archivo=nombre_archivo,
            url=url,
            id_aprendiz=aprendiz.id_usuario,
        )
        self.db.add(nuevo)
        self.db.commit()
        self.db.refresh(nuevo)
        return nuevo

    def _obtener_carpeta_o_404(
        self, categoria: str, subcarpeta: str, id_carpeta: int, aprendiz: Usuario
    ) -> CarpetaAprendiz:
        self._verificar_categoria(categoria)
        self._verificar_subcarpeta(subcarpeta)
        carpeta = (
            self.db.query(CarpetaAprendiz)
            .filter(
                CarpetaAprendiz.id_carpeta == id_carpeta,
                CarpetaAprendiz.id_aprendiz == aprendiz.id_usuario,
                CarpetaAprendiz.categoria == categoria,
                CarpetaAprendiz.subcarpeta == subcarpeta,
            )
            .first()
        )
        if not carpeta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esa carpeta no existe.",
            )
        return carpeta

    def obtener_detalle_carpeta(
        self, categoria: str, subcarpeta: str, id_carpeta: int, aprendiz: Usuario
    ) -> CarpetaAprendizResponse:
        carpeta = self._obtener_carpeta_o_404(categoria, subcarpeta, id_carpeta, aprendiz)
        archivos = (
            self.db.query(ArchivoPortafolio)
            .filter(ArchivoPortafolio.id_carpeta == carpeta.id_carpeta)
            .order_by(ArchivoPortafolio.fecha_subida.desc())
            .all()
        )
        return CarpetaAprendizResponse(
            id_carpeta=carpeta.id_carpeta,
            nombre=carpeta.nombre,
            total_archivos=len(archivos),
            ultima_modificacion=archivos[0].fecha_subida if archivos else carpeta.fecha_creacion,
        )

    def obtener_archivos_de_carpeta(
        self, categoria: str, subcarpeta: str, id_carpeta: int, aprendiz: Usuario
    ) -> list[ArchivoPortafolioResponse]:
        carpeta = self._obtener_carpeta_o_404(categoria, subcarpeta, id_carpeta, aprendiz)
        return (
            self.db.query(ArchivoPortafolio)
            .filter(ArchivoPortafolio.id_carpeta == carpeta.id_carpeta)
            .order_by(ArchivoPortafolio.fecha_subida.desc())
            .all()
        )

    def agregar_archivo_a_carpeta(
        self,
        categoria: str,
        subcarpeta: str,
        id_carpeta: int,
        nombre_archivo: str,
        url: str,
        aprendiz: Usuario,
        id_tarea: int | None = None,
    ) -> ArchivoPortafolio:
        carpeta = self._obtener_carpeta_o_404(categoria, subcarpeta, id_carpeta, aprendiz)
        if id_tarea is not None:
            self._vincular_a_tarea(id_tarea, nombre_archivo, url, aprendiz)
        nuevo = ArchivoPortafolio(
            categoria=categoria,
            subcarpeta=subcarpeta,
            id_carpeta=carpeta.id_carpeta,
            nombre_archivo=nombre_archivo,
            url=url,
            id_aprendiz=aprendiz.id_usuario,
        )
        self.db.add(nuevo)
        self.db.commit()
        self.db.refresh(nuevo)
        return nuevo