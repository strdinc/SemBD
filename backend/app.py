import os
from datetime import datetime
from pathlib import Path

import oracledb
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


def _create_pool():
    user = os.getenv("ORACLE_USER", "stud15")
    password = os.getenv("ORACLE_PASSWORD", "stud15")
    dsn = os.getenv("ORACLE_DSN", "82.179.14.185:1521/nmics")
    return oracledb.create_pool(user=user, password=password, dsn=dsn, min=1, max=4, increment=1)


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
app = Flask(__name__, static_folder=str(frontend_dist), static_url_path="/")
CORS(app)
pool = _create_pool()


def _fetch_all(query, params=None):
    with pool.acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params or {})
            columns = [col[0].lower() for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _call_proc(proc_name, params):
    with pool.acquire() as connection:
        with connection.cursor() as cursor:
            cursor.callproc(proc_name, params)
            connection.commit()


@app.get("/api/stores")
def list_stores():
    rows = _fetch_all("SELECT STORE_ID, STORE_NAME FROM SEM_STORE ORDER BY STORE_ID")
    return jsonify(rows)


@app.get("/api/customers")
def list_customers():
    rows = _fetch_all(
        "SELECT CUSTOMER_ID, FULL_NAME, PHONE FROM SEM_CUSTOMER ORDER BY CUSTOMER_ID"
    )
    return jsonify(rows)


@app.get("/api/sellers")
def list_sellers():
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
    payload = request.get_json(force=True)
    action = payload.get("action")
    sale_id = payload.get("id")
    store_id = payload.get("store_id")
    seller_id = payload.get("seller_id")
    customer_id = payload.get("customer_id")
    sale_date = payload.get("sale_date")

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
    sort_entity = request.args.get("sort_entity") == "1"
    sort_op = request.args.get("sort_op") == "1"
    sort_count = request.args.get("sort_count") == "1"

    order_parts = []
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
    payload = request.get_json(force=True)
    log_id = payload.get("log_id")
    _call_proc("SEM_PKG_LOG_TOOLS.ROLLBACK_ACTION", [log_id])
    return jsonify({"status": "ok"})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/<path:path>")
def serve_static(path):
    file_path = frontend_dist / path
    if file_path.exists():
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
