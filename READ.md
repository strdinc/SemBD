# Описание процедур, функций и клиентских обработчиков

## SQL: sem2_point1.sql

### Пакет `SEM_PKG_CORE_CRUD`
- **ADD_SELLER(p_id, p_name, p_store_id)** — добавляет нового продавца в таблицу `SEM_SELLER`, принимая идентификатор продавца, ФИО и идентификатор магазина.
- **UPD_SELLER(p_id, p_name, p_store_id)** — обновляет данные продавца по `SELLER_ID`, меняя ФИО и привязку к магазину.
- **DEL_SELLER(p_id)** — удаляет продавца по идентификатору из `SEM_SELLER`.
- **ADD_CUSTOMER(p_id, p_name, p_phone)** — создаёт запись покупателя в `SEM_CUSTOMER` с ФИО и телефоном.
- **UPD_CUSTOMER(p_id, p_name, p_phone)** — обновляет данные покупателя по `CUSTOMER_ID`.
- **DEL_CUSTOMER(p_id)** — удаляет покупателя из таблицы `SEM_CUSTOMER`.
- **ADD_SALE(p_id, p_store_id, p_seller_id, p_customer_id, p_date)** — вставляет запись продажи в `SEM_SALE`, фиксируя магазин, продавца, покупателя и дату.
- **UPD_SALE(p_id, p_store_id, p_seller_id, p_customer_id, p_date)** — обновляет параметры продажи по `SALE_ID`.
- **DEL_SALE(p_id)** — удаляет продажу по идентификатору.

### Пакет `SEM_PKG_LOG_TOOLS`
- **GET_VAL(p_kv, p_key)** — извлекает значение по ключу из строки формата `KEY=VALUE;`, возвращая `NULL`, если ключ не найден или строка пуста.
- **VIEW_LOG(p_from, p_to, p_op, p_entity)** — выводит журнал операций по фильтрам даты, операции и сущности через `DBMS_OUTPUT`.
- **ROLLBACK_ACTION(p_log_id)** — выполняет откат одной операции по записи в `SEM_ENTITY_LOG`, восстанавливая удалённые данные или отменяя вставку/обновление.
- **SUMMARY_REPORT(p_sort_entity, p_sort_op, p_sort_count)** — выводит агрегированную статистику по операциям журнала с сортировкой по выбранным полям.

## Python: backend/app.py

- **_create_pool()** — создаёт пул соединений Oracle, используя переменные окружения и логируя статус подключения.
- **_get_short_path(path)** — (Windows) возвращает короткий путь к директории instant client для корректного поиска DLL.
- **_fetch_all(query, params=None)** — выполняет SELECT-запрос, преобразует строки в список словарей и возвращает результат.
- **_execute_sql(query)** — выполняет произвольный SQL, возвращая данные SELECT или количество затронутых строк для DML.
- **_call_proc(proc_name, params)** — вызывает хранимую процедуру Oracle и фиксирует транзакцию.
- **handle_exception(error)** — центральный обработчик ошибок Flask, форматирующий ответ в JSON.
- **list_stores()** — эндпоинт `/api/stores`, возвращает список магазинов.
- **list_customers()** — эндпоинт `/api/customers`, возвращает список покупателей.
- **list_sellers()** — эндпоинт `/api/sellers`, возвращает продавцов с названием магазина.
- **list_sales()** — эндпоинт `/api/sales`, возвращает продажи с деталями по сущностям.
- **manage_customers()** — эндпоинт `/api/customers`, выполняет CRUD-операции над покупателями через пакет `SEM_PKG_CORE_CRUD`.
- **manage_sellers()** — эндпоинт `/api/sellers`, выполняет CRUD-операции над продавцами через пакет `SEM_PKG_CORE_CRUD`.
- **manage_sales()** — эндпоинт `/api/sales`, выполняет CRUD-операции над продажами с преобразованием даты.
- **list_logs()** — эндпоинт `/api/logs`, возвращает журнал операций с фильтрами.
- **log_summary()** — эндпоинт `/api/logs/summary`, формирует агрегированную сводку по журналу.
- **rollback_action()** — эндпоинт `/api/logs/rollback`, запускает откат операции по `LOG_ID`.
- **health()** — эндпоинт `/api/health`, возвращает статус сервера.
- **list_tables()** — эндпоинт `/api/tables`, возвращает список таблиц схемы.
- **table_details(table_name)** — эндпоинт `/api/tables/<table_name>`, возвращает первые строки таблицы.
- **run_sql()** — эндпоинт `/api/sql`, выполняет пользовательский SQL-запрос.
- **serve_index()** — отдаёт `index.html` фронтенда.
- **serve_static(path)** — отдаёт статический ресурс или fallback на `index.html`.

## React: frontend/src/App.jsx

- **App()** — корневой React-компонент, который управляет вкладками, формами CRUD и состояниями данных.
- **showMessage(message, severity)** — показывает toast-уведомление с уровнем важности.
- **getErrorMessage(error, fallback)** — извлекает человекочитаемое сообщение об ошибке из ответа API.
- **refreshAll()** — загружает магазины, покупателей, продавцов и продажи, обновляя состояние справочников.
- **loadLogs()** — запрашивает журнал операций с учётом фильтров.
- **loadSummary()** — загружает сводку по журналу и применяет сортировку.
- **loadTables()** — получает список доступных таблиц схемы.
- **handleConnect()** — инициирует подключение (health-check) и переводит интерфейс в рабочий режим.
- **handleCustomerAction(action)** — выполняет добавление, обновление или удаление покупателя.
- **handleSellerAction(action)** — выполняет добавление, обновление или удаление продавца.
- **handleSaleAction(action)** — выполняет добавление, обновление или удаление продажи.
- **handleRollback()** — запускает откат операции по выбранному логу.
- **handleSqlRun()** — отправляет SQL-запрос на выполнение и отображает результат.
- **handleTableOpen(tableName)** — открывает выбранную таблицу и загружает её строки.

## React: frontend/src/api.js

- **fetchStores()** — получает список магазинов через API.
- **fetchCustomers()** — получает список покупателей через API.
- **fetchSellers()** — получает список продавцов через API.
- **fetchSales()** — получает список продаж через API.
- **fetchLogs(params)** — получает журнал операций с параметрами фильтрации.
- **fetchLogSummary(params)** — получает агрегированную сводку по журналу.
- **rollbackLog(payload)** — запускает откат операции по записи лога.
- **fetchTables()** — получает перечень таблиц схемы.
- **fetchTableData(tableName)** — получает строки выбранной таблицы.
- **executeSql(payload)** — выполняет произвольный SQL-запрос через API.
- **fetchHealth()** — проверяет доступность API.
- **manageCustomer(payload)** — отправляет CRUD-операцию по покупателю.
- **manageSeller(payload)** — отправляет CRUD-операцию по продавцу.
- **manageSale(payload)** — отправляет CRUD-операцию по продаже.
