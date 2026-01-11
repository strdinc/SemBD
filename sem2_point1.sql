SET DEFINE OFF;
SET SERVEROUTPUT ON;

PROMPT ===== 0) SAFE DROP (ignore errors) =====

-- Поочерёдно удаляем объекты; ошибки игнорируем, чтобы скрипт был идемпотентным.
BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER SEM_TRG_ENTITY_LOG_ID'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER SEM_TRG_SALE_LOG';       EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER SEM_TRG_CUSTOMER_LOG';   EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER SEM_TRG_SELLER_LOG';     EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP PACKAGE SEM_PKG_LOG_TOOLS';      EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP PACKAGE SEM_PKG_CORE_CRUD';      EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE SEM_ENTITY_LOG_SEQ';    EXCEPTION WHEN OTHERS THEN NULL; END;
/

BEGIN EXECUTE IMMEDIATE 'DROP TABLE SEM_SALE CASCADE CONSTRAINTS PURGE';       EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE SEM_SELLER CASCADE CONSTRAINTS PURGE';     EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE SEM_CUSTOMER CASCADE CONSTRAINTS PURGE';   EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE SEM_STORE CASCADE CONSTRAINTS PURGE';      EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE SEM_ENTITY_LOG CASCADE CONSTRAINTS PURGE'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

PROMPT ===== 1) CREATE TABLES (BASE + LOG) =====

-- SEM_STORE: справочник магазинов, используется продавцами и продажами.
-- STORE_ID — первичный ключ; STORE_NAME —  название.
CREATE TABLE SEM_STORE (
    STORE_ID   NUMBER PRIMARY KEY,
    STORE_NAME VARCHAR2(100) NOT NULL
);

-- SEM_CUSTOMER: справочник покупателей с именем и телефоном.
-- PHONE не обязателен, чтобы допускать отсутствующие контакты.
CREATE TABLE SEM_CUSTOMER (
    CUSTOMER_ID NUMBER PRIMARY KEY,
    FULL_NAME   VARCHAR2(100) NOT NULL,
    PHONE       VARCHAR2(20)
);

-- SEM_SELLER: продавцы, каждый продавец принадлежит магазину.
-- STORE_ID связан внешним ключом с SEM_STORE.
CREATE TABLE SEM_SELLER (
    SELLER_ID NUMBER PRIMARY KEY,
    FULL_NAME VARCHAR2(100) NOT NULL,
    STORE_ID  NUMBER NOT NULL,
    CONSTRAINT SEM_FK_SELLER_STORE
        FOREIGN KEY (STORE_ID) REFERENCES SEM_STORE(STORE_ID)
);

-- SEM_SALE: факты продаж — кто, где и когда совершил продажу.
-- Внешние ключи фиксируют связи с магазином, продавцом и покупателем.
CREATE TABLE SEM_SALE (
    SALE_ID     NUMBER PRIMARY KEY,
    STORE_ID    NUMBER NOT NULL,
    SELLER_ID   NUMBER NOT NULL,
    CUSTOMER_ID NUMBER NOT NULL,
    SALE_DATE   DATE   NOT NULL,
    CONSTRAINT SEM_FK_SALE_STORE
        FOREIGN KEY (STORE_ID) REFERENCES SEM_STORE(STORE_ID),
    CONSTRAINT SEM_FK_SALE_SELLER
        FOREIGN KEY (SELLER_ID) REFERENCES SEM_SELLER(SELLER_ID),
    CONSTRAINT SEM_FK_SALE_CUSTOMER
        FOREIGN KEY (CUSTOMER_ID) REFERENCES SEM_CUSTOMER(CUSTOMER_ID)
);

-- SEM_ENTITY_LOG: журнал изменений для INSERT/UPDATE/DELETE.
-- OLD_DATA и NEW_DATA хранят сериализованные данные в формате KEY=VALUE;.
CREATE TABLE SEM_ENTITY_LOG (
    LOG_ID        NUMBER PRIMARY KEY,
    ENTITY_NAME   VARCHAR2(50)  NOT NULL,
    ENTITY_PK     VARCHAR2(100) NOT NULL,
    OPERATION     VARCHAR2(10)  NOT NULL,
    OLD_DATA      CLOB,
    NEW_DATA      CLOB,
    OPERATION_DT  DATE DEFAULT SYSDATE NOT NULL
);

-- Индексы по времени операции и по типу сущности/операции.
CREATE INDEX SEM_IX_LOG_DT   ON SEM_ENTITY_LOG(OPERATION_DT);
CREATE INDEX SEM_IX_LOG_MAIN ON SEM_ENTITY_LOG(ENTITY_NAME, OPERATION);

-- SEQUENCE + trigger формируют LOG_ID без IDENTITY (для Oracle 11g+).
CREATE SEQUENCE SEM_ENTITY_LOG_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE OR REPLACE TRIGGER SEM_TRG_ENTITY_LOG_ID
BEFORE INSERT ON SEM_ENTITY_LOG
FOR EACH ROW
BEGIN
    IF :NEW.LOG_ID IS NULL THEN
        SELECT SEM_ENTITY_LOG_SEQ.NEXTVAL INTO :NEW.LOG_ID FROM DUAL;
    END IF;
END;
/
SHOW ERRORS;

PROMPT ===== 2) INSERT DEMO DATA (5-10 rows) =====

-- Заполняем базовые справочники тестовыми значениями.
INSERT INTO SEM_STORE VALUES (1, 'TechnoMart');
INSERT INTO SEM_STORE VALUES (2, 'FreshFoods');
INSERT INTO SEM_STORE VALUES (3, 'BookWorld');
INSERT INTO SEM_STORE VALUES (4, 'SportZone');
INSERT INTO SEM_STORE VALUES (5, 'Home&Kitchen');

INSERT INTO SEM_CUSTOMER VALUES (1, 'Alice Johnson', '1234567890');
INSERT INTO SEM_CUSTOMER VALUES (2, 'Bob Smith',     '0987654321');
INSERT INTO SEM_CUSTOMER VALUES (3, 'Charlie Brown', '5551234567');
INSERT INTO SEM_CUSTOMER VALUES (4, 'Diana Prince',  '7778889999');
INSERT INTO SEM_CUSTOMER VALUES (5, 'Ethan Hunt',    '9990001122');
INSERT INTO SEM_CUSTOMER VALUES (6, 'Fiona Mills',   '2223334445');

INSERT INTO SEM_SELLER VALUES (1, 'Evan Torres',    1);
INSERT INTO SEM_SELLER VALUES (2, 'Maria Hill',    2);
INSERT INTO SEM_SELLER VALUES (3, 'Liam Davis',    3);
INSERT INTO SEM_SELLER VALUES (4, 'Sophia Turner', 4);
INSERT INTO SEM_SELLER VALUES (5, 'Noah Brooks',   5);

INSERT INTO SEM_SALE VALUES (1, 1, 1, 1, DATE '2024-04-01');
INSERT INTO SEM_SALE VALUES (2, 2, 2, 2, DATE '2024-04-02');
INSERT INTO SEM_SALE VALUES (3, 3, 3, 3, DATE '2024-04-03');
INSERT INTO SEM_SALE VALUES (4, 4, 4, 4, DATE '2024-04-04');
INSERT INTO SEM_SALE VALUES (5, 5, 5, 5, DATE '2024-04-05');
INSERT INTO SEM_SALE VALUES (6, 1, 1, 6, DATE '2024-04-06');
INSERT INTO SEM_SALE VALUES (7, 2, 2, 1, DATE '2024-04-07');
INSERT INTO SEM_SALE VALUES (8, 3, 3, 2, DATE '2024-04-08');

COMMIT;

PROMPT ===== 3) CRUD PACKAGE (insert/update/delete for 3 entities) =====

-- Пакет SEM_PKG_CORE_CRUD предоставляет API для CRUD по трём сущностям.
CREATE OR REPLACE PACKAGE SEM_PKG_CORE_CRUD AS
    -- Продавцы.
    PROCEDURE ADD_SELLER(p_id NUMBER, p_name VARCHAR2, p_store_id NUMBER);
    PROCEDURE UPD_SELLER(p_id NUMBER, p_name VARCHAR2, p_store_id NUMBER);
    PROCEDURE DEL_SELLER(p_id NUMBER);

    -- Покупатели.
    PROCEDURE ADD_CUSTOMER(p_id NUMBER, p_name VARCHAR2, p_phone VARCHAR2);
    PROCEDURE UPD_CUSTOMER(p_id NUMBER, p_name VARCHAR2, p_phone VARCHAR2);
    PROCEDURE DEL_CUSTOMER(p_id NUMBER);

    -- Продажи.
    PROCEDURE ADD_SALE(p_id NUMBER, p_store_id NUMBER, p_seller_id NUMBER, p_customer_id NUMBER, p_date DATE);
    PROCEDURE UPD_SALE(p_id NUMBER, p_store_id NUMBER, p_seller_id NUMBER, p_customer_id NUMBER, p_date DATE);
    PROCEDURE DEL_SALE(p_id NUMBER);
END SEM_PKG_CORE_CRUD;
/
SHOW ERRORS;

CREATE OR REPLACE PACKAGE BODY SEM_PKG_CORE_CRUD AS
    -- Вставка продавца с привязкой к магазину.
    PROCEDURE ADD_SELLER(p_id NUMBER, p_name VARCHAR2, p_store_id NUMBER) IS
    BEGIN
        INSERT INTO SEM_SELLER(SELLER_ID, FULL_NAME, STORE_ID)
        VALUES (p_id, p_name, p_store_id);
    END;

    -- Обновление ФИО и магазина для продавца.
    PROCEDURE UPD_SELLER(p_id NUMBER, p_name VARCHAR2, p_store_id NUMBER) IS
    BEGIN
        UPDATE SEM_SELLER
           SET FULL_NAME = p_name,
               STORE_ID  = p_store_id
         WHERE SELLER_ID = p_id;
    END;

    -- Удаление продавца по идентификатору.
    PROCEDURE DEL_SELLER(p_id NUMBER) IS
    BEGIN
        DELETE FROM SEM_SELLER WHERE SELLER_ID = p_id;
    END;

    -- Вставка покупателя с контактным телефоном (если есть).
    PROCEDURE ADD_CUSTOMER(p_id NUMBER, p_name VARCHAR2, p_phone VARCHAR2) IS
    BEGIN
        INSERT INTO SEM_CUSTOMER(CUSTOMER_ID, FULL_NAME, PHONE)
        VALUES (p_id, p_name, p_phone);
    END;

    -- Обновление профиля покупателя.
    PROCEDURE UPD_CUSTOMER(p_id NUMBER, p_name VARCHAR2, p_phone VARCHAR2) IS
    BEGIN
        UPDATE SEM_CUSTOMER
           SET FULL_NAME = p_name,
               PHONE     = p_phone
         WHERE CUSTOMER_ID = p_id;
    END;

    -- Удаление покупателя по ключу.
    PROCEDURE DEL_CUSTOMER(p_id NUMBER) IS
    BEGIN
        DELETE FROM SEM_CUSTOMER WHERE CUSTOMER_ID = p_id;
    END;

    -- Добавление продажи: фиксируем участников и дату.
    PROCEDURE ADD_SALE(p_id NUMBER, p_store_id NUMBER, p_seller_id NUMBER, p_customer_id NUMBER, p_date DATE) IS
    BEGIN
        INSERT INTO SEM_SALE(SALE_ID, STORE_ID, SELLER_ID, CUSTOMER_ID, SALE_DATE)
        VALUES (p_id, p_store_id, p_seller_id, p_customer_id, p_date);
    END;

    -- Обновление деталей продажи.
    PROCEDURE UPD_SALE(p_id NUMBER, p_store_id NUMBER, p_seller_id NUMBER, p_customer_id NUMBER, p_date DATE) IS
    BEGIN
        UPDATE SEM_SALE
           SET STORE_ID    = p_store_id,
               SELLER_ID   = p_seller_id,
               CUSTOMER_ID = p_customer_id,
               SALE_DATE   = p_date
         WHERE SALE_ID = p_id;
    END;

    -- Удаление продажи по идентификатору.
    PROCEDURE DEL_SALE(p_id NUMBER) IS
    BEGIN
        DELETE FROM SEM_SALE WHERE SALE_ID = p_id;
    END;
END SEM_PKG_CORE_CRUD;
/
SHOW ERRORS;

PROMPT ===== 4) TRIGGERS: AUTO-LOGGING for 3 entities =====

-- Триггеры записывают изменения в SEM_ENTITY_LOG.
-- Для NEW_DATA и OLD_DATA используется формат KEY=VALUE;, удобный для отката.
CREATE OR REPLACE TRIGGER SEM_TRG_SELLER_LOG
BEFORE INSERT OR UPDATE OR DELETE ON SEM_SELLER
FOR EACH ROW
DECLARE
    v_old CLOB;
    v_new CLOB;
BEGIN
    IF INSERTING THEN
        v_new := 'SELLER_ID='||:NEW.SELLER_ID||';FULL_NAME='||:NEW.FULL_NAME||';STORE_ID='||:NEW.STORE_ID||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SELLER', TO_CHAR(:NEW.SELLER_ID), 'INSERT', NULL, v_new);

    ELSIF UPDATING THEN
        v_old := 'SELLER_ID='||:OLD.SELLER_ID||';FULL_NAME='||:OLD.FULL_NAME||';STORE_ID='||:OLD.STORE_ID||';';
        v_new := 'SELLER_ID='||:NEW.SELLER_ID||';FULL_NAME='||:NEW.FULL_NAME||';STORE_ID='||:NEW.STORE_ID||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SELLER', TO_CHAR(:OLD.SELLER_ID), 'UPDATE', v_old, v_new);

    ELSIF DELETING THEN
        v_old := 'SELLER_ID='||:OLD.SELLER_ID||';FULL_NAME='||:OLD.FULL_NAME||';STORE_ID='||:OLD.STORE_ID||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SELLER', TO_CHAR(:OLD.SELLER_ID), 'DELETE', v_old, NULL);
    END IF;
END;
/
SHOW ERRORS;

CREATE OR REPLACE TRIGGER SEM_TRG_CUSTOMER_LOG
BEFORE INSERT OR UPDATE OR DELETE ON SEM_CUSTOMER
FOR EACH ROW
DECLARE
    v_old CLOB;
    v_new CLOB;
BEGIN
    IF INSERTING THEN
        v_new := 'CUSTOMER_ID='||:NEW.CUSTOMER_ID||';FULL_NAME='||:NEW.FULL_NAME||';PHONE='||:NEW.PHONE||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('CUSTOMER', TO_CHAR(:NEW.CUSTOMER_ID), 'INSERT', NULL, v_new);

    ELSIF UPDATING THEN
        v_old := 'CUSTOMER_ID='||:OLD.CUSTOMER_ID||';FULL_NAME='||:OLD.FULL_NAME||';PHONE='||:OLD.PHONE||';';
        v_new := 'CUSTOMER_ID='||:NEW.CUSTOMER_ID||';FULL_NAME='||:NEW.FULL_NAME||';PHONE='||:NEW.PHONE||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('CUSTOMER', TO_CHAR(:OLD.CUSTOMER_ID), 'UPDATE', v_old, v_new);

    ELSIF DELETING THEN
        v_old := 'CUSTOMER_ID='||:OLD.CUSTOMER_ID||';FULL_NAME='||:OLD.FULL_NAME||';PHONE='||:OLD.PHONE||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('CUSTOMER', TO_CHAR(:OLD.CUSTOMER_ID), 'DELETE', v_old, NULL);
    END IF;
END;
/
SHOW ERRORS;

CREATE OR REPLACE TRIGGER SEM_TRG_SALE_LOG
BEFORE INSERT OR UPDATE OR DELETE ON SEM_SALE
FOR EACH ROW
DECLARE
    v_old CLOB;
    v_new CLOB;
BEGIN
    IF INSERTING THEN
        v_new := 'SALE_ID='||:NEW.SALE_ID||';STORE_ID='||:NEW.STORE_ID||';SELLER_ID='||:NEW.SELLER_ID||
                 ';CUSTOMER_ID='||:NEW.CUSTOMER_ID||';SALE_DATE='||TO_CHAR(:NEW.SALE_DATE,'YYYY-MM-DD')||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SALE', TO_CHAR(:NEW.SALE_ID), 'INSERT', NULL, v_new);

    ELSIF UPDATING THEN
        v_old := 'SALE_ID='||:OLD.SALE_ID||';STORE_ID='||:OLD.STORE_ID||';SELLER_ID='||:OLD.SELLER_ID||
                 ';CUSTOMER_ID='||:OLD.CUSTOMER_ID||';SALE_DATE='||TO_CHAR(:OLD.SALE_DATE,'YYYY-MM-DD')||';';
        v_new := 'SALE_ID='||:NEW.SALE_ID||';STORE_ID='||:NEW.STORE_ID||';SELLER_ID='||:NEW.SELLER_ID||
                 ';CUSTOMER_ID='||:NEW.CUSTOMER_ID||';SALE_DATE='||TO_CHAR(:NEW.SALE_DATE,'YYYY-MM-DD')||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SALE', TO_CHAR(:OLD.SALE_ID), 'UPDATE', v_old, v_new);

    ELSIF DELETING THEN
        v_old := 'SALE_ID='||:OLD.SALE_ID||';STORE_ID='||:OLD.STORE_ID||';SELLER_ID='||:OLD.SELLER_ID||
                 ';CUSTOMER_ID='||:OLD.CUSTOMER_ID||';SALE_DATE='||TO_CHAR(:OLD.SALE_DATE,'YYYY-MM-DD')||';';
        INSERT INTO SEM_ENTITY_LOG(ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA, NEW_DATA)
        VALUES ('SALE', TO_CHAR(:OLD.SALE_ID), 'DELETE', v_old, NULL);
    END IF;
END;
/
SHOW ERRORS;

PROMPT ===== 5) LOG TOOLS PACKAGE (view / rollback / summary) =====

-- Пакет SEM_PKG_LOG_TOOLS выводит журнал, делает откат и строит сводки.
CREATE OR REPLACE PACKAGE SEM_PKG_LOG_TOOLS AS
    -- Печать журнала с фильтрами по датам, операции и сущности.
    PROCEDURE VIEW_LOG(
        p_from   DATE DEFAULT NULL,
        p_to     DATE DEFAULT NULL,
        p_op     VARCHAR2 DEFAULT NULL,
        p_entity VARCHAR2 DEFAULT NULL
    );

    -- Откат конкретной операции по LOG_ID.
    PROCEDURE ROLLBACK_ACTION(p_log_id NUMBER);

    -- Сводный отчёт по журналу с управляемой сортировкой.
    PROCEDURE SUMMARY_REPORT(
        p_sort_entity BOOLEAN,
        p_sort_op     BOOLEAN,
        p_sort_count  BOOLEAN
    );
END SEM_PKG_LOG_TOOLS;
/
SHOW ERRORS;

CREATE OR REPLACE PACKAGE BODY SEM_PKG_LOG_TOOLS AS

    -- GET_VAL извлекает значение из строки вида KEY=VALUE;.
    -- Возвращает NULL при отсутствии ключа или при пустой строке.
    FUNCTION GET_VAL(p_kv CLOB, p_key VARCHAR2) RETURN VARCHAR2 IS
        v_value VARCHAR2(4000);
    BEGIN
        IF p_kv IS NULL THEN
            RETURN NULL;
        END IF;

        v_value := REGEXP_SUBSTR(p_kv, p_key || '=[^;]*;', 1, 1);

        IF v_value IS NULL THEN
            RETURN NULL;
        END IF;

        v_value := REGEXP_REPLACE(v_value, '^' || p_key || '=', '');
        v_value := REGEXP_REPLACE(v_value, ';$', '');
        RETURN v_value;
    END;

    -- VIEW_LOG печатает строки журнала в DBMS_OUTPUT.
    PROCEDURE VIEW_LOG(
        p_from   DATE DEFAULT NULL,
        p_to     DATE DEFAULT NULL,
        p_op     VARCHAR2 DEFAULT NULL,
        p_entity VARCHAR2 DEFAULT NULL
    ) IS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('--- LOG ---');
        FOR r IN (
            SELECT LOG_ID, ENTITY_NAME, ENTITY_PK, OPERATION, OPERATION_DT
              FROM SEM_ENTITY_LOG
             WHERE (p_from   IS NULL OR OPERATION_DT >= p_from)
               AND (p_to     IS NULL OR OPERATION_DT <= p_to)
               AND (p_op     IS NULL OR OPERATION = UPPER(p_op))
               AND (p_entity IS NULL OR ENTITY_NAME = UPPER(p_entity))
             ORDER BY OPERATION_DT DESC, LOG_ID DESC
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                'LOG_ID='||r.LOG_ID||' | '||TO_CHAR(r.OPERATION_DT,'YYYY-MM-DD HH24:MI:SS')||
                ' | '||r.ENTITY_NAME||'('||r.ENTITY_PK||') | '||r.OPERATION
            );
        END LOOP;
    END;

    -- ROLLBACK_ACTION восстанавливает состояние по конкретной записи журнала.
    PROCEDURE ROLLBACK_ACTION(p_log_id NUMBER) IS
        v_entity SEM_ENTITY_LOG.ENTITY_NAME%TYPE;
        v_pk     SEM_ENTITY_LOG.ENTITY_PK%TYPE;
        v_op     SEM_ENTITY_LOG.OPERATION%TYPE;
        v_old    CLOB;

        v_name       VARCHAR2(200);
        v_phone      VARCHAR2(50);
        v_store_id   NUMBER;
        v_seller_id  NUMBER;
        v_cust_id    NUMBER;
        v_sale_dt    DATE;
    BEGIN
        SELECT ENTITY_NAME, ENTITY_PK, OPERATION, OLD_DATA
          INTO v_entity, v_pk, v_op, v_old
          FROM SEM_ENTITY_LOG
         WHERE LOG_ID = p_log_id;

        v_entity := UPPER(v_entity);
        v_op     := UPPER(v_op);

        IF v_op = 'INSERT' THEN
            IF v_entity = 'SELLER' THEN
                DELETE FROM SEM_SELLER WHERE SELLER_ID = TO_NUMBER(v_pk);
            ELSIF v_entity = 'CUSTOMER' THEN
                DELETE FROM SEM_CUSTOMER WHERE CUSTOMER_ID = TO_NUMBER(v_pk);
            ELSIF v_entity = 'SALE' THEN
                DELETE FROM SEM_SALE WHERE SALE_ID = TO_NUMBER(v_pk);
            END IF;

        ELSIF v_op = 'DELETE' THEN
            IF v_entity = 'SELLER' THEN
                v_name := GET_VAL(v_old, 'FULL_NAME');
                v_store_id := TO_NUMBER(GET_VAL(v_old, 'STORE_ID'));
                INSERT INTO SEM_SELLER(SELLER_ID, FULL_NAME, STORE_ID)
                VALUES (TO_NUMBER(v_pk), v_name, v_store_id);

            ELSIF v_entity = 'CUSTOMER' THEN
                v_name := GET_VAL(v_old, 'FULL_NAME');
                v_phone := GET_VAL(v_old, 'PHONE');
                INSERT INTO SEM_CUSTOMER(CUSTOMER_ID, FULL_NAME, PHONE)
                VALUES (TO_NUMBER(v_pk), v_name, v_phone);

            ELSIF v_entity = 'SALE' THEN
                v_store_id := TO_NUMBER(GET_VAL(v_old, 'STORE_ID'));
                v_seller_id := TO_NUMBER(GET_VAL(v_old, 'SELLER_ID'));
                v_cust_id := TO_NUMBER(GET_VAL(v_old, 'CUSTOMER_ID'));
                v_sale_dt := TO_DATE(GET_VAL(v_old, 'SALE_DATE'), 'YYYY-MM-DD');
                INSERT INTO SEM_SALE(SALE_ID, STORE_ID, SELLER_ID, CUSTOMER_ID, SALE_DATE)
                VALUES (TO_NUMBER(v_pk), v_store_id, v_seller_id, v_cust_id, v_sale_dt);
            END IF;

        ELSIF v_op = 'UPDATE' THEN
            IF v_entity = 'SELLER' THEN
                v_name := GET_VAL(v_old, 'FULL_NAME');
                v_store_id := TO_NUMBER(GET_VAL(v_old, 'STORE_ID'));
                UPDATE SEM_SELLER
                   SET FULL_NAME = v_name,
                       STORE_ID  = v_store_id
                 WHERE SELLER_ID = TO_NUMBER(v_pk);

            ELSIF v_entity = 'CUSTOMER' THEN
                v_name := GET_VAL(v_old, 'FULL_NAME');
                v_phone := GET_VAL(v_old, 'PHONE');
                UPDATE SEM_CUSTOMER
                   SET FULL_NAME = v_name,
                       PHONE     = v_phone
                 WHERE CUSTOMER_ID = TO_NUMBER(v_pk);

            ELSIF v_entity = 'SALE' THEN
                v_store_id := TO_NUMBER(GET_VAL(v_old, 'STORE_ID'));
                v_seller_id := TO_NUMBER(GET_VAL(v_old, 'SELLER_ID'));
                v_cust_id := TO_NUMBER(GET_VAL(v_old, 'CUSTOMER_ID'));
                v_sale_dt := TO_DATE(GET_VAL(v_old, 'SALE_DATE'), 'YYYY-MM-DD');
                UPDATE SEM_SALE
                   SET STORE_ID    = v_store_id,
                       SELLER_ID   = v_seller_id,
                       CUSTOMER_ID = v_cust_id,
                       SALE_DATE   = v_sale_dt
                 WHERE SALE_ID = TO_NUMBER(v_pk);
            END IF;
        END IF;

        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Rollback ok: LOG_ID='||p_log_id||' ('||v_entity||' '||v_op||')');
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20001, 'Log record not found: '||p_log_id);
    END;

    -- SUMMARY_REPORT строит агрегированную статистику по журналу.
    PROCEDURE SUMMARY_REPORT(
        p_sort_entity BOOLEAN,
        p_sort_op     BOOLEAN,
        p_sort_count  BOOLEAN
    ) IS
        v_sql   VARCHAR2(4000);
        v_order VARCHAR2(1000) := '';
        rc SYS_REFCURSOR;

        v_entity VARCHAR2(50);
        v_op2    VARCHAR2(10);
        v_cnt    NUMBER;
    BEGIN
        v_sql := 'SELECT ENTITY_NAME, OPERATION, COUNT(*) CNT
                    FROM SEM_ENTITY_LOG
                   GROUP BY ENTITY_NAME, OPERATION';

        IF p_sort_entity THEN
            v_order := v_order || ' ENTITY_NAME';
        END IF;

        IF p_sort_op THEN
            IF LENGTH(TRIM(v_order)) > 0 THEN v_order := v_order || ', '; END IF;
            v_order := v_order || ' OPERATION';
        END IF;

        IF p_sort_count THEN
            IF LENGTH(TRIM(v_order)) > 0 THEN v_order := v_order || ', '; END IF;
            v_order := v_order || ' CNT';
        END IF;

        IF LENGTH(TRIM(v_order)) > 0 THEN
            v_sql := v_sql || ' ORDER BY ' || v_order;
        END IF;

        DBMS_OUTPUT.PUT_LINE('--- SUMMARY ---');
        OPEN rc FOR v_sql;
        LOOP
            FETCH rc INTO v_entity, v_op2, v_cnt;
            EXIT WHEN rc%NOTFOUND;
            DBMS_OUTPUT.PUT_LINE(v_entity||' | '||v_op2||' | '||v_cnt);
        END LOOP;
        CLOSE rc;
    END;

END SEM_PKG_LOG_TOOLS;
/
SHOW ERRORS;


PROMPT ===== 6) SMOKE TEST (генерим лог + смотрим) =====

-- Демонстрационный прогон CRUD-процедур для наполнения журнала.
BEGIN
    SEM_PKG_CORE_CRUD.ADD_CUSTOMER(10, 'Test Customer', '7000000000');
    SEM_PKG_CORE_CRUD.UPD_CUSTOMER(10, 'Test Customer Updated', '7111111111');
    SEM_PKG_CORE_CRUD.DEL_CUSTOMER(10);

    SEM_PKG_CORE_CRUD.ADD_SELLER(10, 'Test Seller', 1);
    SEM_PKG_CORE_CRUD.UPD_SELLER(10, 'Test Seller Updated', 2);
    SEM_PKG_CORE_CRUD.DEL_SELLER(10);

    SEM_PKG_CORE_CRUD.ADD_SALE(20, 1, 1, 1, DATE '2024-04-09');
    SEM_PKG_CORE_CRUD.UPD_SALE(20, 2, 2, 2, DATE '2024-04-10');
    SEM_PKG_CORE_CRUD.DEL_SALE(20);

    COMMIT;
END;
/

-- Пример вывода журнала за последние 30 дней.
BEGIN
    SEM_PKG_LOG_TOOLS.VIEW_LOG(p_from => SYSDATE - 30);
END;
/

-- Пример сводки с сортировкой по сущности, операции и количеству.
BEGIN
    SEM_PKG_LOG_TOOLS.SUMMARY_REPORT(TRUE, TRUE, TRUE);
END;
/

PROMPT ===== DONE =====
