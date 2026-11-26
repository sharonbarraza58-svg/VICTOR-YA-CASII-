"""
Rutas de "Mi perfil" (botón "Actualizar datos") para los 3 roles.

El id del usuario SIEMPRE sale del token (get_current_active_user), nunca de
la URL: nadie puede leer ni editar el perfil de otra persona por aquí.

Se registran en main.py con tres prefijos distintos:

    /api/coordinador/perfil              GET, PUT
    /api/coordinador/perfil/hoja-vida    POST
    /api/coordinador/instructores/{id}/hoja-vida   POST (coordinador sube la
                                                    hoja de vida de un instructor)
    /api/instructor/perfil               GET, PUT
    /api/instructor/perfil/hoja-vida     POST
    /api/aprendiz/perfil                 GET, PUT
"""
import os
import re
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.security import get_current_active_user, require_coordinador
from db.database import get_db
from models.coordinacion import Coordinacion
from models.ficha import Ficha
from models.programa import Programa
from models.sede import Sede
from models.usuario import Usuario

# --------------------------------------------------------------------------
# Constantes
# --------------------------------------------------------------------------
TIPOS_DOCUMENTO = {"CC", "TI", "CE", "PPT", "PEP"}
EXTENSIONES_HOJA_VIDA = {".pdf", ".doc", ".docx"}
TAMANO_MAXIMO = 15 * 1024 * 1024  # 15 MB

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta donde está main.py
CARPETA_HOJAS = os.path.join(BASE_DIR, "uploads", "hojas_vida")
URL_HOJAS = "/uploads/hojas_vida"


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class CambiosPerfil(BaseModel):
    """Solo se envían los campos modificados (todos opcionales)."""

    correo_personal: Optional[str] = None
    telefono: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    especialidad: Optional[str] = None  # solo lo usa el instructor


class PerfilCoordinadorOut(BaseModel):
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None
    correo_sena: str
    correo_personal: str
    telefono: Optional[str] = None
    tipo_documento: str
    numero_documento: str
    fecha_nacimiento: Optional[str] = None
    estado: Optional[str] = None
    fecha_creacion: Optional[str] = None
    tipo_contrato: Optional[str] = None
    estado_contrato: Optional[str] = None
    vigencia_contrato: Optional[str] = None
    hoja_vida_url: Optional[str] = None
    hoja_vida_nombre: Optional[str] = None
    nombre_sede: Optional[str] = None
    nombre_coordinacion: Optional[str] = None
    area_enfoque: Optional[str] = None


class PerfilInstructorOut(BaseModel):
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None
    correo_sena: str
    correo_personal: str
    telefono: Optional[str] = None
    tipo_documento: str
    numero_documento: str
    fecha_nacimiento: Optional[str] = None
    especialidad: Optional[str] = None
    tipo_contrato: Optional[str] = None
    estado_contrato: Optional[str] = None
    vigencia_contrato: Optional[str] = None
    tipo_instructor: Optional[str] = None
    hoja_vida_url: Optional[str] = None
    hoja_vida_nombre: Optional[str] = None
    nombre_sede: Optional[str] = None
    nombre_coordinacion: Optional[str] = None


class PerfilAprendizOut(BaseModel):
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None
    correo_sena: str
    correo_personal: str
    telefono: Optional[str] = None
    tipo_documento: str
    numero_documento: str
    fecha_nacimiento: Optional[str] = None
    estado: Optional[str] = None
    fecha_creacion: Optional[str] = None
    id_ficha: Optional[int] = None
    numero_ficha: Optional[str] = None
    trimestre: Optional[str] = None
    horario: Optional[str] = None
    fecha_inicio_ficha: Optional[str] = None
    fecha_fin_ficha: Optional[str] = None
    nombre_programa: Optional[str] = None
    nivel_formacion: Optional[str] = None
    nombre_director: Optional[str] = None


class HojaVidaOut(BaseModel):
    hoja_vida_url: Optional[str] = None
    hoja_vida_nombre: Optional[str] = None


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def _iso(valor) -> Optional[str]:
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return None


def _nombre_hoja(url: Optional[str]) -> Optional[str]:
    """Recupera el nombre original del archivo. Se guarda como
    '<8 hex>__<nombre original>', así no hace falta una columna nueva."""
    if not url:
        return None
    archivo = url.rsplit("/", 1)[-1]
    return archivo.split("__", 1)[1] if "__" in archivo else archivo


def _nombre_sede(db: Session, u: Usuario) -> Optional[str]:
    if not u.id_sede:
        return None
    sede = db.get(Sede, u.id_sede)
    return sede.nombre if sede else None


def _coordinacion(db: Session, u: Usuario) -> Optional[Coordinacion]:
    return db.get(Coordinacion, u.id_coordinacion) if u.id_coordinacion else None


def _a_coordinador(db: Session, u: Usuario) -> PerfilCoordinadorOut:
    coord = _coordinacion(db, u)
    return PerfilCoordinadorOut(
        id_usuario=u.id_usuario,
        nombre=u.nombre,
        apellido=u.apellido,
        correo_sena=u.correo_sena,
        correo_personal=u.correo_personal,
        telefono=u.telefono,
        tipo_documento=u.tipo_documento,
        numero_documento=u.numero_documento,
        fecha_nacimiento=_iso(u.fecha_nacimiento),
        estado=u.estado,
        fecha_creacion=_iso(u.fecha_creacion),
        tipo_contrato=u.tipo_contrato,
        estado_contrato=u.estado_contrato,
        vigencia_contrato=_iso(u.vigencia_contrato),
        hoja_vida_url=u.hoja_vida_url,
        hoja_vida_nombre=_nombre_hoja(u.hoja_vida_url),
        nombre_sede=_nombre_sede(db, u),
        nombre_coordinacion=coord.nombre_coordinacion if coord else None,
        area_enfoque=coord.area_enfoque if coord else None,
    )


def _a_instructor(db: Session, u: Usuario) -> PerfilInstructorOut:
    coord = _coordinacion(db, u)
    return PerfilInstructorOut(
        id_usuario=u.id_usuario,
        nombre=u.nombre,
        apellido=u.apellido,
        correo_sena=u.correo_sena,
        correo_personal=u.correo_personal,
        telefono=u.telefono,
        tipo_documento=u.tipo_documento,
        numero_documento=u.numero_documento,
        fecha_nacimiento=_iso(u.fecha_nacimiento),
        especialidad=u.especialidad,
        tipo_contrato=u.tipo_contrato,
        estado_contrato=u.estado_contrato,
        vigencia_contrato=_iso(u.vigencia_contrato),
        tipo_instructor=u.tipo_instructor,
        hoja_vida_url=u.hoja_vida_url,
        hoja_vida_nombre=_nombre_hoja(u.hoja_vida_url),
        nombre_sede=_nombre_sede(db, u),
        nombre_coordinacion=coord.nombre_coordinacion if coord else None,
    )


def _a_aprendiz(db: Session, u: Usuario) -> PerfilAprendizOut:
    ficha = db.get(Ficha, u.id_ficha) if u.id_ficha else None
    programa = db.get(Programa, ficha.id_programa) if ficha and ficha.id_programa else None
    director = db.get(Usuario, ficha.id_director) if ficha and ficha.id_director else None
    nombre_director = None
    if director:
        nombre_director = f"{director.nombre} {director.apellido or ''}".strip()
    return PerfilAprendizOut(
        id_usuario=u.id_usuario,
        nombre=u.nombre,
        apellido=u.apellido,
        correo_sena=u.correo_sena,
        correo_personal=u.correo_personal,
        telefono=u.telefono,
        tipo_documento=u.tipo_documento,
        numero_documento=u.numero_documento,
        fecha_nacimiento=_iso(u.fecha_nacimiento),
        estado=u.estado,
        fecha_creacion=_iso(u.fecha_creacion),
        id_ficha=ficha.id_ficha if ficha else None,
        numero_ficha=str(ficha.id_ficha) if ficha else None,
        trimestre=ficha.trimestre if ficha else None,
        horario=ficha.horario if ficha else None,
        fecha_inicio_ficha=_iso(ficha.fecha_inicio) if ficha else None,
        fecha_fin_ficha=_iso(ficha.fecha_fin) if ficha else None,
        nombre_programa=programa.nombre if programa else None,
        nivel_formacion=programa.nivel_formacion if programa else None,
        nombre_director=nombre_director,
    )


def _exigir_rol(usuario: Usuario, rol: str) -> None:
    if usuario.nombre_rol != rol:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Esta sección es solo para el rol {rol}.")


def _limpiar(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor = valor.strip()
    return valor or None


def _aplicar_cambios(db: Session, u: Usuario, cambios: CambiosPerfil, permitir_especialidad: bool) -> None:
    """Valida y aplica solo los campos enviados. Nada de rol, estado, contrato, etc."""
    datos = cambios.model_dump(exclude_unset=True) if hasattr(cambios, "model_dump") else cambios.dict(exclude_unset=True)

    if "correo_personal" in datos:
        correo = _limpiar(datos["correo_personal"])
        if not correo or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", correo):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El correo personal no es válido.")
        repetido = (
            db.query(Usuario)
            .filter(Usuario.correo_personal == correo, Usuario.id_usuario != u.id_usuario)
            .first()
        )
        if repetido:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo personal ya está registrado.")
        u.correo_personal = correo

    if "telefono" in datos:
        u.telefono = _limpiar(datos["telefono"])

    if "tipo_documento" in datos:
        tipo = (_limpiar(datos["tipo_documento"]) or "").upper()
        if tipo not in TIPOS_DOCUMENTO:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Tipo de documento inválido. Usa: {', '.join(sorted(TIPOS_DOCUMENTO))}.",
            )
        u.tipo_documento = tipo

    if "numero_documento" in datos:
        numero = _limpiar(datos["numero_documento"])
        if not numero:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El número de documento es obligatorio.")
        repetido = (
            db.query(Usuario)
            .filter(Usuario.numero_documento == numero, Usuario.id_usuario != u.id_usuario)
            .first()
        )
        if repetido:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese número de documento ya está registrado.")
        u.numero_documento = numero

    if permitir_especialidad and "especialidad" in datos:
        u.especialidad = _limpiar(datos["especialidad"])


async def _guardar_hoja_vida(db: Session, destino: Usuario, archivo: UploadFile) -> HojaVidaOut:
    nombre_original = os.path.basename(archivo.filename or "")
    extension = os.path.splitext(nombre_original)[1].lower()
    if extension not in EXTENSIONES_HOJA_VIDA:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Solo se permiten archivos PDF o Word (.pdf, .doc, .docx)."
        )

    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo está vacío.")
    if len(contenido) > TAMANO_MAXIMO:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo supera el máximo de 15 MB.")

    os.makedirs(CARPETA_HOJAS, exist_ok=True)
    seguro = re.sub(r"[^A-Za-z0-9._-]", "_", nombre_original)
    nombre_disco = f"{uuid.uuid4().hex[:8]}__{seguro}"
    with open(os.path.join(CARPETA_HOJAS, nombre_disco), "wb") as f:
        f.write(contenido)

    anterior = destino.hoja_vida_url
    destino.hoja_vida_url = f"{URL_HOJAS}/{nombre_disco}"
    db.commit()
    db.refresh(destino)

    # Borra la hoja de vida anterior para no acumular archivos huérfanos.
    if anterior and anterior.startswith(URL_HOJAS):
        ruta_vieja = os.path.join(CARPETA_HOJAS, anterior.rsplit("/", 1)[-1])
        try:
            os.remove(ruta_vieja)
        except OSError:
            pass

    return HojaVidaOut(hoja_vida_url=destino.hoja_vida_url, hoja_vida_nombre=_nombre_hoja(destino.hoja_vida_url))


# ==========================================================================
# COORDINADOR  ->  /api/coordinador/...
# ==========================================================================
router_coordinador = APIRouter()


@router_coordinador.get("/perfil", response_model=PerfilCoordinadorOut)
def mi_perfil_coordinador(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_coordinador),
):
    return _a_coordinador(db, usuario)


@router_coordinador.put("/perfil", response_model=PerfilCoordinadorOut)
def actualizar_mi_perfil_coordinador(
    cambios: CambiosPerfil,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_coordinador),
):
    _aplicar_cambios(db, usuario, cambios, permitir_especialidad=False)
    db.commit()
    db.refresh(usuario)
    return _a_coordinador(db, usuario)


@router_coordinador.post("/perfil/hoja-vida", response_model=PerfilCoordinadorOut)
async def subir_mi_hoja_vida_coordinador(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_coordinador),
):
    await _guardar_hoja_vida(db, usuario, archivo)
    return _a_coordinador(db, usuario)


@router_coordinador.post("/instructores/{id_instructor}/hoja-vida", response_model=HojaVidaOut)
async def subir_hoja_vida_de_instructor(
    id_instructor: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_coordinador),
):
    """El coordinador adjunta la hoja de vida de un instructor (pantalla
    coordinador/instructores/[idInstructor])."""
    instructor = db.get(Usuario, id_instructor)
    if not instructor or instructor.nombre_rol != "instructor":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Instructor no encontrado.")
    return await _guardar_hoja_vida(db, instructor, archivo)


# ==========================================================================
# INSTRUCTOR  ->  /api/instructor/...
# ==========================================================================
router_instructor = APIRouter()


@router_instructor.get("/perfil", response_model=PerfilInstructorOut)
def mi_perfil_instructor(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_active_user),
):
    _exigir_rol(usuario, "instructor")
    return _a_instructor(db, usuario)


@router_instructor.put("/perfil", response_model=PerfilInstructorOut)
def actualizar_mi_perfil_instructor(
    cambios: CambiosPerfil,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_active_user),
):
    _exigir_rol(usuario, "instructor")
    _aplicar_cambios(db, usuario, cambios, permitir_especialidad=True)
    db.commit()
    db.refresh(usuario)
    return _a_instructor(db, usuario)


@router_instructor.post("/perfil/hoja-vida", response_model=PerfilInstructorOut)
async def subir_mi_hoja_vida_instructor(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_active_user),
):
    _exigir_rol(usuario, "instructor")
    await _guardar_hoja_vida(db, usuario, archivo)
    return _a_instructor(db, usuario)


# ==========================================================================
# APRENDIZ  ->  /api/aprendiz/...
# ==========================================================================
router_aprendiz = APIRouter()


@router_aprendiz.get("/perfil", response_model=PerfilAprendizOut)
def mi_perfil_aprendiz(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_active_user),
):
    _exigir_rol(usuario, "aprendiz")
    return _a_aprendiz(db, usuario)


@router_aprendiz.put("/perfil", response_model=PerfilAprendizOut)
def actualizar_mi_perfil_aprendiz(
    cambios: CambiosPerfil,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_active_user),
):
    _exigir_rol(usuario, "aprendiz")
    _aplicar_cambios(db, usuario, cambios, permitir_especialidad=False)
    db.commit()
    db.refresh(usuario)
    return _a_aprendiz(db, usuario)