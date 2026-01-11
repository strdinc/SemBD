import logging
import os
from datetime import datetime
from pathlib import Path
from platform import system
import ctypes

import oracledb
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Создаём пул подключений к Oracle с параметрами из переменных окружения.
# Значения по умолчанию заданы для учебного стенда и могут быть переопределены.
def _create_pool():
    user = os.getenv("ORACLE_USER", "stud15")
    dsn = os.getenv("ORACLE_DSN", "82.179.14.185:1521/nmics")
    logger.info("Creating Oracle pool for user=%s dsn=%s", user, dsn)
    try:
        password = os.getenv("ORACLE_PASSWORD", "stud15")
        # Параметры пула подобраны для небольшого числа одновременных запросов.
        return oracledb.create_pool(
            user=user,
            password=password,
            dsn=dsn,
            min=1,
            max=4,
            increment=1,
        )
    except Exception:
        logger.exception("Failed to create Oracle connection pool")
        raise


# BASE_DIR используется для поиска клиентских библиотек и статического фронтенда.
BASE_DIR = Path(__file__).resolve().parent
INSTANT_CLIENT_DIR = BASE_DIR / "instantclient_23_0"

if INSTANT_CLIENT_DIR.exists():
    # Пытаемся включить thick-режим Oracle, если клиентская библиотека доступна.
    logger.info("Initializing Oracle thick mode from %s", INSTANT_CLIENT_DIR)
    try:
        if system() == "Windows":
            # На Windows иногда требуется короткий путь к директории с DLL.
            def _get_short_path(path):
                buffer = ctypes.create_unicode_buffer(260)
                if ctypes.windll.kernel32.GetShortPathNameW(str(path), buffer, len(buffer)):
                    return buffer.value
                return str(path)

            short_path = _get_short_path(INSTANT_CLIENT_DIR)
            # Обновляем PATH и регистрируем каталог DLL для текущего процесса.
            os.environ["PATH"] = f"{short_path}{os.pathsep}{os.environ.get('PATH', '')}"
            os.add_dll_directory(short_path)
            oracledb.init_oracle_client(lib_dir=short_path)
        else:
            # На Linux/macOS достаточно указать путь к библиотеке клиента.
            oracledb.init_oracle_client(lib_dir=str(INSTANT_CLIENT_DIR))
    except Exception:
        logger.exception("Failed to initialize Oracle thick mode; continuing in thin mode")

# Путь к собранному фронтенду (Vite build).
frontend_dist = BASE_DIR.parent / "frontend" / "dist"
app = Flask(__name__, static_folder=str(frontend_dist), static_url_path="/")
CORS(app)
pool = _create_pool()


# Унифицированный helper для SELECT-запросов, возвращающий список словарей.
# Используется всеми GET-эндпоинтами, чтобы результат был JSON-совместимым.
def _fetch_all(query, params=None):
    logger.info("DB fetch: %s params=%s", query.strip().splitlines()[0], params or {})
    try:
        with pool.acquire() as connection:
            with connection.cursor() as cursor:
                # params может быть None, поэтому подставляем пустой словарь.
                cursor.execute(query, params or {})
                columns = [col[0].lower() for col in cursor.description]
                rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                logger.info("DB fetch returned %s rows", len(rows))
                return rows
    except Exception:
        logger.exception("DB fetch failed")
        raise


# Унифицированный helper для выполнения произвольного SQL (SELECT или DML).
# Возвращает структуру с типом результата, списком колонок и строками (если SELECT).
def _execute_sql(query):
    logger.info("DB execute: %s", query.strip().splitlines()[0])
    try:
        with pool.acquire() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                if cursor.description:
                    # SELECT-запрос: формируем список колонок и строк.
                    columns = [col[0].lower() for col in cursor.description]
                    rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                    logger.info("DB execute returned %s rows", len(rows))
                    return {
                        "type": "select",
                        "columns": columns,
                        "rows": rows,
                        "row_count": len(rows),
                    }
                # DML-запрос: фиксируем изменения и возвращаем число затронутых строк.
                connection.commit()
                logger.info("DB execute affected %s rows", cursor.rowcount)
                return {"type": "mutation", "row_count": cursor.rowcount}
    except Exception:
        logger.exception("DB execute failed")
        raise


# Вызов хранимой процедуры с параметрами и коммитом транзакции.
# Используется для CRUD-процедур и отката по журналу.
def _call_proc(proc_name, params):
    logger.info("DB call proc: %s params=%s", proc_name, params)
    try:
        with pool.acquire() as connection:
            with connection.cursor() as cursor:
                cursor.callproc(proc_name, params)
                connection.commit()
    except Exception:
        logger.exception("DB procedure call failed")
        raise


@app.errorhandler(Exception)
def handle_exception(error):
    # Централизованный обработчик ошибок для API.
    # Для HTTPException возвращаем стандартные коды, для остальных — 500.
    if isinstance(error, HTTPException):
        return jsonify({"error": error.name, "message": error.description}), error.code
    logger.exception("Unhandled error")
    return jsonify({"error": "Internal Server Error", "message": str(error)}), 500


@app.get("/api/stores")
def list_stores():
    # Возвращает список магазинов для справочника.
    # Используется фронтендом для выпадающих списков и таблиц.
    rows = _fetch_all("SELECT STORE_ID, STORE_NAME FROM SEM_STORE ORDER BY STORE_ID")
    return jsonify(rows)


@app.get("/api/customers")
def list_customers():
    # Возвращает список покупателей для справочника.
    # Данные нужны для форм добавления/редактирования продаж.
    rows = _fetch_all(
        "SELECT CUSTOMER_ID, FULL_NAME, PHONE FROM SEM_CUSTOMER ORDER BY CUSTOMER_ID"
    )
    return jsonify(rows)


@app.get("/api/sellers")
def list_sellers():
    # Возвращает список продавцов с именем магазина.
    # JOIN нужен, чтобы фронтенд отображал название магазина без доп. запросов.
    rows = _fetch_all(
        """
        SELECT s.SELLER_ID, s.FULL_NAME, s.STORE_ID, st.STORE_NAME
          FROM SEM_SELLER s
          JOIN SEM_STORE st ON st.STORE_ID = s.STORE_ID
         ORDER BY s.SELLER_ID
        """
    )
    return jsonify(rows)


@app.get("/api/sales")
def list_sales():
    # Возвращает список продаж с деталями по продавцу/покупателю/магазину.
    # Дату приводим к строке, чтобы JSON был стабильным.
    rows = _fetch_all(
        """
        SELECT sale.SALE_ID,
               sale.STORE_ID,
               st.STORE_NAME,
               sale.SELLER_ID,
               sel.FULL_NAME AS SELLER_NAME,
               sale.CUSTOMER_ID,
               cust.FULL_NAME AS CUSTOMER_NAME,
               TO_CHAR(sale.SALE_DATE, 'YYYY-MM-DD') AS SALE_DATE
          FROM SEM_SALE sale
          JOIN SEM_STORE st ON st.STORE_ID = sale.STORE_ID
          JOIN SEM_SELLER sel ON sel.SELLER_ID = sale.SELLER_ID
          JOIN SEM_CUSTOMER cust ON cust.CUSTOMER_ID = sale.CUSTOMER_ID
         ORDER BY sale.SALE_ID
        """
    )
    return jsonify(rows)


@app.post("/api/customers")
def manage_customers():
    # Обрабатывает CRUD-операции над покупателями через пакет SEM_PKG_CORE_CRUD.
    # В action ожидается add/update/delete, остальные значения отклоняются.
    payload = request.get_json(force=True)
    action = payload.get("action")
    customer_id = payload.get("id")
    full_name = payload.get("name")
    phone = payload.get("phone")

    if action == "add":
        _call_proc("SEM_PKG_CORE_CRUD.ADD_CUSTOMER", [customer_id, full_name, phone])
    elif action == "update":
        _call_proc("SEM_PKG_CORE_CRUD.UPD_CUSTOMER", [customer_id, full_name, phone])
    elif action == "delete":
        _call_proc("SEM_PKG_CORE_CRUD.DEL_CUSTOMER", [customer_id])
    else:
        return jsonify({"error": "Unknown action"}), 400

    return jsonify({"status": "ok"})


@app.post("/api/sellers")
def manage_sellers():
    # Обрабатывает CRUD-операции над продавцами через пакет SEM_PKG_CORE_CRUD.
    # store_id обязателен для привязки продавца к магазину.
    payload = request.get_json(force=True)
    action = payload.get("action")
    seller_id = payload.get("id")
    full_name = payload.get("name")
    store_id = payload.get("store_id")

    if action == "add":
        _call_proc("SEM_PKG_CORE_CRUD.ADD_SELLER", [seller_id, full_name, store_id])
    elif action == "update":
        _call_proc("SEM_PKG_CORE_CRUD.UPD_SELLER", [seller_id, full_name, store_id])
    elif action == "delete":
        _call_proc("SEM_PKG_CORE_CRUD.DEL_SELLER", [seller_id])
    else:
        return jsonify({"error": "Unknown action"}), 400

    return jsonify({"status": "ok"})


@app.post("/api/sales")
def manage_sales():
    # CRUD-операции по продажам с приведением даты в формат Oracle.
    # При отсутствии даты для delete допускается NULL.
    payload = request.get_json(force=True)
    action = payload.get("action")
    sale_id = payload.get("id")
    store_id = payload.get("store_id")
    seller_id = payload.get("seller_id")
    customer_id = payload.get("customer_id")
    sale_date = payload.get("sale_date")

    # Преобразуем дату из ISO-формата для Oracle DATE.
    sale_dt = datetime.strptime(sale_date, "%Y-%m-%d").date() if sale_date else None

    if action == "add":
        _call_proc(
            "SEM_PKG_CORE_CRUD.ADD_SALE",
            [sale_id, store_id, seller_id, customer_id, sale_dt],
        )
    elif action == "update":
        _call_proc(
            "SEM_PKG_CORE_CRUD.UPD_SALE",
            [sale_id, store_id, seller_id, customer_id, sale_dt],
        )
    elif action == "delete":
        _call_proc("SEM_PKG_CORE_CRUD.DEL_SALE", [sale_id])
    else:
        return jsonify({"error": "Unknown action"}), 400

    return jsonify({"status": "ok"})


@app.get("/api/logs")
def list_logs():
    # Возвращает журнал изменений с фильтрами по параметрам запроса.
    # Фильтры опциональны: если параметр не передан, условие игнорируется.
    params = {
        "from_date": request.args.get("from"),
        "to_date": request.args.get("to"),
        "op": request.args.get("op"),
        "entity": request.args.get("entity"),
    }

    rows = _fetch_all(
        """
        SELECT LOG_ID,
               ENTITY_NAME,
               ENTITY_PK,
               OPERATION,
               TO_CHAR(OPERATION_DT, 'YYYY-MM-DD HH24:MI:SS') AS OPERATION_DT
          FROM SEM_ENTITY_LOG
         WHERE (:from_date IS NULL OR OPERATION_DT >= TO_DATE(:from_date, 'YYYY-MM-DD'))
           AND (:to_date IS NULL OR OPERATION_DT <= TO_DATE(:to_date, 'YYYY-MM-DD'))
           AND (:op IS NULL OR OPERATION = UPPER(:op))
           AND (:entity IS NULL OR ENTITY_NAME = UPPER(:entity))
         ORDER BY OPERATION_DT DESC, LOG_ID DESC
        """,
        params,
    )
    return jsonify(rows)


@app.get("/api/logs/summary")
def log_summary():
    # Возвращает агрегированную сводку по журналу с динамической сортировкой.
    # Параметры sort_entity/sort_op/sort_count приходят как "1" или "0".
    sort_entity = request.args.get("sort_entity") == "1"
    sort_op = request.args.get("sort_op") == "1"
    sort_count = request.args.get("sort_count") == "1"

    order_parts = []
    # Порядок сортировки формируем на основе флагов из UI.
    if sort_entity:
        order_parts.append("ENTITY_NAME")
    if sort_op:
        order_parts.append("OPERATION")
    if sort_count:
        order_parts.append("CNT")

    order_by = f"ORDER BY {', '.join(order_parts)}" if order_parts else ""
    rows = _fetch_all(
        f"""
        SELECT ENTITY_NAME,
               OPERATION,
               COUNT(*) AS CNT
          FROM SEM_ENTITY_LOG
         GROUP BY ENTITY_NAME, OPERATION
         {order_by}
        """
    )
    return jsonify(rows)


@app.post("/api/logs/rollback")
def rollback_action():
    # Запускает откат операции по записи журнала.
    # Использует процедуру SEM_PKG_LOG_TOOLS.ROLLBACK_ACTION.
    payload = request.get_json(force=True)
    log_id = payload.get("log_id")
    _call_proc("SEM_PKG_LOG_TOOLS.ROLLBACK_ACTION", [log_id])
    return jsonify({"status": "ok"})


@app.get("/api/health")
def health():
    # Health-check для проверки доступности API.
    # Нужен фронтенду для отображения статуса соединения.
    return jsonify({"status": "ok"})


@app.get("/api/tables")
def list_tables():
    # Список пользовательских таблиц в схеме Oracle.
    # Используется интерфейсом для динамического обзора таблиц.
    rows = _fetch_all("SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME")
    return jsonify(rows)


@app.get("/api/tables/<table_name>")
def table_details(table_name):
    # Возвращает первые 200 строк указанной таблицы.
    # Проверяем наличие таблицы в USER_TABLES, чтобы избежать SQL-инъекций.
    table_name = table_name.upper()
    tables = _fetch_all(
        "SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :table_name",
        {"table_name": table_name},
    )
    if not tables:
        return jsonify({"error": "Table not found"}), 404
    # Ограничиваем выборку 200 строками для безопасного отображения.
    query = f"SELECT * FROM {table_name} WHERE ROWNUM <= 200"
    rows = _fetch_all(query)
    return jsonify({"table": table_name, "rows": rows})


@app.post("/api/sql")
def run_sql():
    # Выполняет пользовательский SQL и возвращает результат или число изменённых строк.
    # Пустой запрос запрещаем, чтобы избежать пустых выполнений.
    payload = request.get_json(force=True)
    query = (payload.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400
    result = _execute_sql(query)
    return jsonify(result)


@app.get("/")
def serve_index():
    # Отдаёт главный HTML-файл фронтенда.
    return send_from_directory(app.static_folder, "index.html")


@app.get("/<path:path>")
def serve_static(path):
    # Отдаёт статические файлы фронтенда или fallback на index.html.
    file_path = frontend_dist / path
    if file_path.exists():
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    # Локальный запуск Flask-приложения.
    app.run(host="0.0.0.0", port=5000, debug=True)
