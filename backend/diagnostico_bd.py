"""
Diagnóstico de la base de datos de VICTORIA.

Compara los modelos de SQLAlchemy (carpeta models/) con las tablas reales de
PostgreSQL y te dice qué tablas y columnas FALTAN. Es el error típico de
"no existe la columna ficha.archivo_url": el modelo ya tiene la columna, pero
la base de datos se creó antes con un script más viejo.

Cómo usarlo (en la carpeta backend, con el venv activado):

    python diagnostico_bd.py             -> solo MUESTRA lo que falta (no cambia nada)
    python diagnostico_bd.py --aplicar   -> crea las tablas y agrega las columnas que faltan

Es seguro volver a correrlo: solo agrega lo que no existe y nunca borra nada.
"""
import importlib
import os
import pkgutil
import sys

from sqlalchemy import inspect, text
from sqlalchemy.schema import CreateColumn

# Para poder importar db/, models/, etc. sin importar desde dónde se ejecute.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import Base  # noqa: E402

try:
    from db.database import engine  # noqa: E402
except ImportError:  # por si el engine se construye con otro nombre
    from dotenv import load_dotenv
    from sqlalchemy import create_engine

    load_dotenv()
    engine = create_engine(os.environ["DATABASE_URL"])

APLICAR = "--aplicar" in sys.argv

# 1) Cargar TODOS los modelos para que Base.metadata conozca todas las tablas.
import models  # noqa: E402

for modulo in pkgutil.iter_modules(models.__path__):
    try:
        importlib.import_module(f"models.{modulo.name}")
    except Exception as e:  # un modelo roto no debe impedir el diagnóstico
        print(f"  (aviso) no pude cargar models.{modulo.name}: {e}")

print("Base de datos:", engine.url.render_as_string(hide_password=True))

# 2) Comparar modelos vs base de datos real.
inspector = inspect(engine)
tablas_en_bd = set(inspector.get_table_names())

tablas_que_faltan = []
columnas_que_faltan = []  # (tabla, columna)
for nombre, tabla in Base.metadata.tables.items():
    if nombre not in tablas_en_bd:
        tablas_que_faltan.append(nombre)
        continue
    columnas_en_bd = {c["name"] for c in inspector.get_columns(nombre)}
    for columna in tabla.columns:
        if columna.name not in columnas_en_bd:
            columnas_que_faltan.append((tabla, columna))


def sentencia_alter(tabla, columna) -> str:
    definicion = str(CreateColumn(columna).compile(dialect=engine.dialect)).strip()
    # Una columna NOT NULL sin valor por defecto no se puede agregar a una tabla
    # que ya tiene filas; se agrega permitiendo NULL (se puede endurecer después).
    nota = ""
    if not columna.nullable and columna.server_default is None:
        definicion = definicion.replace(" NOT NULL", "")
        nota = "   -- (se agrega sin NOT NULL porque la tabla ya puede tener filas)"
    return f'ALTER TABLE "{tabla.name}" ADD COLUMN IF NOT EXISTS {definicion};{nota}'


# 3) Reporte.
print()
if not tablas_que_faltan and not columnas_que_faltan:
    print("✔ La base de datos coincide con los modelos. No falta nada.")
    sys.exit(0)

if tablas_que_faltan:
    print(f"✘ TABLAS que faltan ({len(tablas_que_faltan)}):")
    for t in tablas_que_faltan:
        print(f"    - {t}")
if columnas_que_faltan:
    print(f"✘ COLUMNAS que faltan ({len(columnas_que_faltan)}):")
    for tabla, columna in columnas_que_faltan:
        print(f"    - {tabla.name}.{columna.name}")
    print("\nSentencias SQL equivalentes:")
    for tabla, columna in columnas_que_faltan:
        print("   ", sentencia_alter(tabla, columna))

# 4) Aplicar (solo si se pidió).
if not APLICAR:
    print("\nNo se cambió nada. Para crear lo que falta, ejecuta:")
    print("    python diagnostico_bd.py --aplicar")
    sys.exit(1)

print("\nAplicando cambios…")
if tablas_que_faltan:
    Base.metadata.create_all(engine)  # solo crea las tablas que no existen
    print(f"  ✔ {len(tablas_que_faltan)} tabla(s) creada(s).")
with engine.begin() as conexion:
    for tabla, columna in columnas_que_faltan:
        conexion.execute(text(sentencia_alter(tabla, columna).split("   --")[0]))
        print(f"  ✔ {tabla.name}.{columna.name}")
print("\nListo. Vuelve a correr `python diagnostico_bd.py` para comprobar que no falta nada.")
