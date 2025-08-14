from collections import defaultdict

import asyncpg
import json
from typing import Optional, List, Dict, Any, Union

from fastapi import HTTPException
from uuid6 import uuid7
from config import DB_URL
from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from models import (
    WebAppUser, BotUser, ValidateResponse, EventCreate, EventResponse, EventDateResponse,
    TimeSlotResponse, ActiveEventResponse, ArchivedEventResponse, EventFullResponse, UserResponse, EventDetailsResponse,
    EventSlotResponse, CurrentUserVoteResponse, EventUpdate
)


class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(DB_URL)
        async with self.pool.acquire() as conn:
            await create_tables(conn)
            # await fill_public_id(conn)
            # await fill_test_data(conn)

    async def close(self):
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    async def get_connection(self):
        if self.pool is None:
            await self.connect()
        return self.pool.acquire()


async def create_tables(conn: asyncpg.Connection):
    async with conn.transaction():
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_user_id BIGINT UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                language_code TEXT DEFAULT 'ru',
                is_premium BOOLEAN DEFAULT FALSE,
                allows_write_to_pm BOOLEAN DEFAULT TRUE,
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                public_id uuid NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                description TEXT,
                timezone TEXT NOT NULL DEFAULT 'UTC',
                event_type TEXT NOT NULL DEFAULT 'poll' CHECK (event_type IN ('poll', 'booking')),
                multiple_choice BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                deleted_at TIMESTAMP
            );
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS event_slots (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                slot_start TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                deleted_at TIMESTAMP
            );
        """)

        # Добавляем колонку final_slot_id после создания всех таблиц
        await conn.execute("""
            ALTER TABLE events
            ADD COLUMN IF NOT EXISTS final_slot_id INTEGER REFERENCES event_slots(id) ON DELETE SET NULL;
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS event_votes (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                slot_id INTEGER REFERENCES event_slots(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                deleted_at TIMESTAMP
            );
        """)

        try:
            await conn.execute("""
                ALTER TABLE events 
                ADD CONSTRAINT fk_events_final_slot 
                FOREIGN KEY (final_slot_id) REFERENCES event_slots(id);
            """)
        except asyncpg.exceptions.DuplicateObjectError:
            pass

        print("Таблицы созданы!")


async def fill_public_id(conn: asyncpg.Connection):
    rows = await conn.fetch("SELECT id FROM events WHERE public_id IS NULL")
    for r in rows:
        await conn.execute("UPDATE events SET public_id=$1 WHERE id=$2", str(uuid7()), r["id"])


async def fill_test_data(conn: asyncpg.Connection):
    async with conn.transaction():
        """Заполняет базу данных тестовыми данными с учетом типов событий"""

        # Очищаем все таблицы
        await conn.execute("TRUNCATE TABLE event_votes, event_slots, events, users RESTART IDENTITY CASCADE")

        # Добавляем тестовых пользователей (включая пользователя с telegram_user_id = 287565447)
        await conn.execute("""
            INSERT INTO users (telegram_user_id, username, first_name, last_name, language_code, is_premium)
            VALUES 
                (287565447, 'special_user', 'Алексей', 'Специальный', 'ru', TRUE),
                (111111111, 'ivan_ivanov', 'Иван', 'Иванов', 'ru', FALSE),
                (222222222, 'petr_petrov', 'Пётр', 'Петров', 'ru', TRUE),
                (333333333, 'anna_smith', 'Анна', 'Смит', 'en', FALSE),
                (444444444, 'consultant', 'Мария', 'Консультант', 'ru', FALSE)
        """)

        # Добавляем тестовые события (2 голосования и 2 бронирования от special_user)
        special_user_id = 1  # ID special_user (первая запись после очистки)

        # События, созданные special_user
        event1_id = await conn.fetchval("""
            INSERT INTO events (user_id, title, description, timezone, event_type, multiple_choice)
            VALUES ($1, 'Встреча команды', 'Планирование нового проекта', 'Europe/Moscow', 'poll', FALSE)
            RETURNING id
        """, special_user_id)

        event2_id = await conn.fetchval("""
            INSERT INTO events (user_id, title, description, timezone, event_type, multiple_choice)
            VALUES ($1, 'Обучение', 'Выбор дат для обучения новичков', 'Europe/Moscow', 'poll', TRUE)
            RETURNING id
        """, special_user_id)

        event3_id = await conn.fetchval("""
            INSERT INTO events (user_id, title, timezone, event_type)
            VALUES ($1, 'Индивидуальные консультации', 'Europe/Moscow', 'booking')
            RETURNING id
        """, special_user_id)

        # События, созданные другими пользователями
        event4_id = await conn.fetchval("""
            INSERT INTO events (user_id, title, description, timezone, event_type)
            VALUES (2, 'Футбольный матч', 'Выбор даты для игры', 'UTC', 'poll')
            RETURNING id
        """)

        event5_id = await conn.fetchval("""
            INSERT INTO events (user_id, title, description, timezone, event_type)
            VALUES (4, 'Консультация по проекту', 'Выбор времени', 'Europe/Moscow', 'booking')
            RETURNING id
        """)

        # Добавляем слоты для событий
        # Слоты для встречи команды (голосование)
        await conn.execute("""
            INSERT INTO event_slots (event_id, slot_start)
            VALUES 
                ($1, $2),  
                ($1, $3),  
                ($1, $4)   
        """, event1_id,
                           datetime(2023, 12, 15, 10, 0),
                           datetime(2023, 12, 15, 14, 0),
                           datetime(2023, 12, 16, 11, 0))

        # Слоты для обучения (голосование с множественным выбором)
        for day in range(20, 23):
            await conn.execute(
                "INSERT INTO event_slots (event_id, slot_start) VALUES ($1, $2)",
                event2_id, datetime(2023, 12, day, 18, 0)
            )

        # Слоты для индивидуальных консультаций (бронирование)
        for hour in range(10, 16):
            await conn.execute(
                "INSERT INTO event_slots (event_id, slot_start) VALUES ($1, $2)",
                event3_id, datetime(2023, 12, 19, hour, 0)
            )

        # Слоты для футбола (голосование)
        await conn.execute("""
            INSERT INTO event_slots (event_id, slot_start)
            VALUES ($1, $2), ($1, $3)
        """, event4_id,
                           datetime(2023, 12, 17, 15, 0),
                           datetime(2023, 12, 18, 16, 0))

        # Слоты для консультации по проекту (бронирование с возможностью групповой записи)
        for hour in range(10, 16):
            await conn.execute(
                "INSERT INTO event_slots (event_id, slot_start) VALUES ($1, $2)",
                event5_id, datetime(2023, 12, 20, hour, 0)
            )

        # Добавляем тестовые голоса и бронирования
        await conn.execute("""
            INSERT INTO event_votes (event_id, slot_id, user_id)
            VALUES 
                -- Голоса special_user в чужих событиях
                (4, 7, $1),  
                (4, 8, $1), 

                -- Бронирование special_user в чужом событии
                (5, 11, $1), 

                -- Голоса других пользователей в событиях special_user
                (1, 1, 2), 
                (1, 2, 3),  
                (2, 4, 2),  
                (2, 5, 3), 

                -- Бронирования других пользователей в событиях special_user
                (3, 6, 4) 
        """, special_user_id)

        # Устанавливаем финальные слоты
        await conn.execute("""
            UPDATE events SET final_slot_id = 1 WHERE id = 1
        """)
        await conn.execute("""
            UPDATE events SET final_slot_id = 5 WHERE id = 2
        """)
        await conn.execute("""
            UPDATE events SET final_slot_id = 6 WHERE id = 3
        """)

        print("✅ Тестовые данные успешно добавлены с учетом всех требований")


async def create_or_update_user(conn: asyncpg.Connection, user_data: Union[WebAppUser, BotUser]) -> ValidateResponse:
    async with conn.transaction():
        try:
            # Подготавливаем данные
            db_data = {
                "telegram_user_id": user_data.telegram_user_id,
                "username": user_data.username,
                "first_name": user_data.first_name,
                "last_name": user_data.last_name,
                "language_code": user_data.language_code,
                "is_premium": user_data.is_premium,
                "allows_write_to_pm": user_data.allows_write_to_pm if isinstance(user_data, WebAppUser) else True,
                "photo_url": user_data.photo_url if isinstance(user_data, WebAppUser) else None
            }

            await conn.execute(
                """
                INSERT INTO users 
                (telegram_user_id, username, first_name, last_name, language_code, 
                 is_premium, allows_write_to_pm, photo_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (telegram_user_id) DO UPDATE SET
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    language_code = COALESCE(EXCLUDED.language_code, users.language_code),
                    is_premium = COALESCE(EXCLUDED.is_premium, users.is_premium),
                    allows_write_to_pm = COALESCE(EXCLUDED.allows_write_to_pm, users.allows_write_to_pm),
                    photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url)
                WHERE
                    users.username IS DISTINCT FROM EXCLUDED.username OR
                    users.first_name IS DISTINCT FROM EXCLUDED.first_name OR
                    users.last_name IS DISTINCT FROM EXCLUDED.last_name
                """,
                *db_data.values()
            )

            return ValidateResponse(
                status="ok",
                message="User created or updated successfully",
                user_id=user_data.telegram_user_id
            )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "message": "Database operation failed",
                    "error": str(e)
                }
            )


async def get_slots(conn: asyncpg.Connection, event_id: int):
    event = await conn.fetchrow("SELECT event_type FROM events WHERE id = $1", event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event['event_type'] == 'booking':
        slots = await conn.fetch(
            """
            SELECT id, event_id, slot_start 
            FROM event_slots    
            WHERE event_id = $1 
              AND deleted_at IS NULL
            ORDER BY slot_start 
            """,
            event_id
        )
    else:
        slots = await conn.fetch(
            """
            SELECT id, event_id, slot_start 
            FROM event_slots
            WHERE event_id = $1 AND deleted_at IS NULL
            ORDER BY slot_start
            """,
            event_id
        )

    grouped_slots = defaultdict(list)
    for slot in slots:
        slot_date = slot['slot_start'].date()
        time_str = slot['slot_start'].strftime("%H:%M")
        grouped_slots[slot_date].append({
            "id": slot["id"],
            "time": time_str,
        })
    return grouped_slots


async def create_event(conn: asyncpg.Connection, event_data: EventCreate, telegram_user_id: int):
    try:
        async with conn.transaction():
            user_data = await conn.fetchrow("SELECT id FROM users WHERE telegram_user_id = $1", telegram_user_id)
            if not user_data:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            # 1. Создаем основное событие
            public_id = str(uuid7())
            event = await conn.fetchrow(
                """
                INSERT INTO events 
                (user_id, title, description, timezone, event_type, multiple_choice, public_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
                """,
                user_data['id'],
                event_data.title,
                event_data.description,
                event_data.timezone,
                event_data.event_type,
                event_data.allow_multiple_choice,
                public_id
            )

            slot_values = []
            local_tz = ZoneInfo(event_data.timezone)
            for date_obj in event_data.dates:
                naive_date = date_obj.date.replace(tzinfo=None)
                for time_slot in date_obj.time_slots:
                    hours, minutes = map(int, time_slot.split(":"))
                    slot_local = naive_date.replace(hour=hours, minute=minutes, tzinfo=local_tz)
                    slot_utc = slot_local.astimezone(timezone.utc)
                    slot_values.append((event["id"], slot_utc))
            await conn.executemany(
                "INSERT INTO event_slots (event_id, slot_start) VALUES ($1, $2)",
                slot_values
            )

            grouped_slots = await get_slots(conn, event["id"])
            return EventResponse(**event,
                                 dates=[
                                     EventDateResponse(
                                         date=slot_date,
                                         time_slots=[
                                             TimeSlotResponse(id=s["id"], time=s["time"])
                                             for s in slot_group
                                         ]
                                     )
                                     for slot_date, slot_group in grouped_slots.items()
                                 ])
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {str(e)}"
        )
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )


async def get_active_user_events(conn: asyncpg.Connection, telegram_user_id: int) -> List[ActiveEventResponse]:
    now = datetime.now()

    query = """
    WITH user_events AS (
        -- События, где пользователь создатель
            SELECT 
                e.id,
                e.public_id,
                e.title,
                e.event_type,
                e.final_slot_id,
                TRUE AS is_creator,
                e.created_at,
                (SELECT COUNT(DISTINCT ev.user_id) 
                 FROM event_votes ev 
                 WHERE ev.event_id = e.id AND ev.deleted_at IS NULL) AS participant_count
            FROM events e
            LEFT JOIN event_slots es ON e.final_slot_id = es.id
            JOIN users u ON e.user_id = u.id
            WHERE u.telegram_user_id = $1
            AND e.deleted_at IS NULL
            AND (e.final_slot_id IS NULL OR es.slot_start >= $2)

        UNION

        -- События, где пользователь участник (голосовал или бронировал)
            SELECT 
                e.id,
                e.public_id,
                e.title,
                e.event_type,
                e.final_slot_id,
                FALSE AS is_creator,
                e.created_at,
                (SELECT COUNT(DISTINCT ev.user_id) 
                 FROM event_votes ev 
                 WHERE ev.event_id = e.id AND ev.deleted_at IS NULL) AS participant_count
            FROM events e
            JOIN event_votes ev ON e.id = ev.event_id
            LEFT JOIN event_slots es ON e.final_slot_id = es.id
            JOIN users u ON ev.user_id = u.id
            WHERE u.telegram_user_id = $1
            AND e.user_id != (SELECT id FROM users WHERE telegram_user_id = $1)
            AND e.deleted_at IS NULL
            AND (e.final_slot_id IS NULL OR es.slot_start >= $2)
        )
        SELECT * FROM user_events
        ORDER BY 
            is_creator DESC, 
            CASE WHEN final_slot_id IS NULL THEN 1 ELSE 0 END, 
            created_at DESC
    """

    records = await conn.fetch(query, telegram_user_id, now)
    return [ActiveEventResponse(**record) for record in records]


async def get_archived_user_events(conn: asyncpg.Connection, telegram_user_id: int) -> List[ArchivedEventResponse]:
    now = datetime.now()

    query = """
    WITH user_events AS (
        -- События, где пользователь создатель
        SELECT 
            e.id,
            e.public_id,
            e.title,
            e.event_type,
            e.final_slot_id,
            TRUE AS is_creator,
            e.created_at,
            e.deleted_at IS NOT NULL AS is_deleted,
            (es.slot_start < $2) AS is_expired,
            (SELECT COUNT(DISTINCT ev.user_id) 
             FROM event_votes ev 
             WHERE ev.event_id = e.id AND ev.deleted_at IS NULL) AS participant_count
        FROM events e
        LEFT JOIN event_slots es ON e.final_slot_id = es.id
        JOIN users u ON e.user_id = u.id
        WHERE u.telegram_user_id = $1
        AND (e.deleted_at IS NOT NULL OR es.slot_start < $2)

        UNION

        -- События, где пользователь участник
        SELECT 
            e.id,
            e.public_id,
            e.title,
            e.event_type,
            e.final_slot_id,
            FALSE AS is_creator,
            e.created_at,
            e.deleted_at IS NOT NULL AS is_deleted,
            (es.slot_start < $2) AS is_expired,
            (SELECT COUNT(DISTINCT ev.user_id) 
             FROM event_votes ev 
             WHERE ev.event_id = e.id AND ev.deleted_at IS NULL) AS participant_count
        FROM events e
        JOIN event_votes ev ON e.id = ev.event_id
        LEFT JOIN event_slots es ON e.final_slot_id = es.id
        JOIN users u ON ev.user_id = u.id
        WHERE u.telegram_user_id = $1
        AND e.user_id != (SELECT id FROM users WHERE telegram_user_id = $1)
        AND (e.deleted_at IS NOT NULL OR es.slot_start < $2)
    )
    SELECT * FROM user_events
    ORDER BY 
        is_deleted DESC,
        is_expired DESC,
        CASE WHEN final_slot_id IS NULL THEN 1 ELSE 0 END,
        created_at DESC
    """

    records = await conn.fetch(query, telegram_user_id, now)
    return [ArchivedEventResponse(**record) for record in records]


async def get_event_details_db(conn: asyncpg.Connection, telegram_user_id: int, event_id: int) -> EventFullResponse:
    query = """
        WITH event_data AS (
            SELECT 
                e.id,
                e.public_id,
                e.title,
                e.description,
                e.timezone,
                e.event_type,
                e.multiple_choice,
                e.created_at,
                e.updated_at,
                e.deleted_at,
                e.user_id,
                e.final_slot_id,
                ($1::BIGINT = u.telegram_user_id) AS is_creator,
                json_build_object(
                    'telegram_user_id', u.telegram_user_id,
                    'username', u.username,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url
                ) AS creator
            FROM events e
            JOIN users u ON e.user_id = u.id
            WHERE e.id = $2 AND e.deleted_at IS NULL
        ),
        slots_data AS (
            SELECT
                es.id,
                es.slot_start,
                es.created_at,
                EXISTS (
                    SELECT 1 FROM event_votes ev 
                    JOIN users vu ON ev.user_id = vu.id
                    WHERE ev.slot_id = es.id AND ev.deleted_at IS NULL AND vu.telegram_user_id = $1
                ) AS current_user_voted,
                (
                    SELECT COUNT(*) FROM event_votes WHERE slot_id = es.id AND deleted_at IS NULL
                ) AS vote_count,
                (
                    SELECT json_agg(
                        json_build_object(
                            'telegram_user_id', vu.telegram_user_id,
                            'username', vu.username,
                            'first_name', vu.first_name,
                            'last_name', vu.last_name,
                            'photo_url', vu.photo_url,
                            'voted_at', ev.created_at
                        )
                        ORDER BY ev.created_at DESC
                    )
                    FROM event_votes ev
                    JOIN users vu ON ev.user_id = vu.id
                    WHERE ev.slot_id = es.id AND ev.deleted_at IS NULL
                ) AS voters
            FROM event_slots es
            WHERE es.event_id = $2 AND es.deleted_at IS NULL
            ORDER BY es.slot_start
        ),
        participants_data AS (
            SELECT DISTINCT ON (u.telegram_user_id)
                u.telegram_user_id AS telegram_user_id,
                u.username,
                u.first_name,
                u.last_name,
                u.photo_url
            FROM event_votes ev
            JOIN users u ON ev.user_id = u.id
            WHERE ev.event_id = $2 AND ev.deleted_at IS NULL
            GROUP BY u.telegram_user_id, u.username, u.first_name, u.last_name, u.photo_url
        ),
        current_votes_data AS (
            SELECT 
                ev.slot_id,
                ev.created_at
            FROM event_votes ev
            JOIN users u ON ev.user_id = u.id
            WHERE ev.event_id = $2 AND ev.deleted_at IS NULL AND u.telegram_user_id = $1
        )
        SELECT 
            json_build_object(
                'event', (SELECT row_to_json(ed) FROM event_data ed),
                'slots', COALESCE((SELECT json_agg(sd) FROM slots_data sd), '[]'),
                'participants', COALESCE((SELECT json_agg(pd) FROM participants_data pd), '[]'),
                'current_user_votes', COALESCE((
                    SELECT json_agg(json_build_object('slot_id', slot_id, 'created_at', created_at)) 
                    FROM current_votes_data
                ), '[]')
            ) AS result
        """
    try:
        record = await conn.fetchrow(query, telegram_user_id, event_id)
        if not record or not record['result']:
            raise ValueError("Event not found or invalid data")

        # Десериализация JSON если нужно
        data = record['result'] if not isinstance(record['result'], str) else json.loads(record['result'])
        return EventFullResponse.model_validate(data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON data: {str(e)}")
    except Exception as ex:
        raise ValueError(f"Error processing event data: {str(ex)}")


async def get_event_by_public_id(conn: asyncpg.Connection, telegram_user_id: int, public_id: str) -> Optional[EventFullResponse]:
    event_row = await conn.fetchrow(
        "SELECT id FROM events WHERE public_id=$1 AND deleted_at IS NULL",
        public_id
    )
    if not event_row:
        return None
    return await get_event_details_db(conn, telegram_user_id, event_row["id"])


async def delete_event_db(conn: asyncpg.Connection, user_id: int, event_id: int):
    try:
        async with conn.transaction():
            query = """
                    SELECT EXISTS(
                        SELECT 1 
                        FROM events e
                        JOIN users u ON u.id = e.user_id
                        WHERE 
                            e.id = $1
                            AND u.telegram_user_id = $2
                            AND e.deleted_at IS NULL
                    ) AS is_owner
                """
            is_owner = await conn.fetchval(query, event_id, user_id)
            if not is_owner:
                raise HTTPException(
                    status_code=403,
                    detail="You don't own this event"
                )
            else:
                await conn.execute(
                    "UPDATE events SET deleted_at = $1 WHERE id = $2",
                    datetime.utcnow(), event_id
                )
                return True
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {str(e)}"
        )
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )


# ОБНОВЛЕНИЕ СОБЫТИЙ
async def get_event_by_id(conn: asyncpg.Connection, event_id: int, user_id: int) -> Optional[EventFullResponse]:
    """Получение события по ID с проверкой прав доступа"""
    # Получаем данные события
    event_query = """
        SELECT e.id, e.public_id, e.title, e.description, e.event_type, 
               CASE WHEN e.multiple_choice THEN true ELSE false END as multiple_choice,
               e.timezone, e.created_at, e.updated_at, e.user_id, e.final_slot_id, 
               ($2::BIGINT = u.telegram_user_id) AS is_creator,
               u.telegram_user_id, u.username, u.first_name, u.last_name, u.photo_url
        FROM events e 
        JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.deleted_at IS NULL
    """
    event_row = await conn.fetchrow(event_query, event_id, user_id)

    if not event_row:
        return None

    # Получаем слоты события с информацией о голосах
    slots_query = """
        SELECT s.id, s.slot_start, s.created_at,
               COALESCE(COUNT(v.id), 0) as vote_count,
               CASE WHEN EXISTS(
                   SELECT 1 FROM event_votes v2 WHERE v2.slot_id = s.id AND v2.user_id = $2
               ) THEN true ELSE false END as current_user_voted
        FROM event_slots s
        LEFT JOIN event_votes v ON s.id = v.slot_id
        WHERE s.event_id = $1
        GROUP BY s.id, s.slot_start, s.created_at
        ORDER BY s.slot_start
    """
    slots_rows = await conn.fetch(slots_query, event_id, user_id)

    # Получаем участников события
    participants_query = """
        SELECT DISTINCT u.telegram_user_id, u.username, u.first_name, u.last_name, u.photo_url
        FROM users u
        JOIN event_votes v ON u.id = v.user_id
        JOIN event_slots s ON v.slot_id = s.id
        WHERE s.event_id = $1 AND v.deleted_At IS NULL 
        ORDER BY u.first_name, u.username
    """
    participants_rows = await conn.fetch(participants_query, event_id)

    # Получаем голоса текущего пользователя
    user_votes_query = """
        SELECT v.slot_id, v.created_at
        FROM event_votes v
        JOIN event_slots s ON v.slot_id = s.id
        WHERE s.event_id = $1 AND v.user_id = $2
        ORDER BY v.created_at
    """
    user_votes_rows = await conn.fetch(user_votes_query, event_id, user_id)

    # Формируем ответ
    creator_data = UserResponse(
        telegram_user_id=event_row['telegram_user_id'],
        username=event_row['username'],
        first_name=event_row['first_name'],
        last_name=event_row['last_name'],
        photo_url=event_row['photo_url']
    )

    event_data = EventDetailsResponse(
        id=event_row['id'],
        public_id=event_row['public_id'],
        title=event_row['title'],
        description=event_row['description'],
        timezone=event_row['timezone'],
        event_type=event_row['event_type'],
        multiple_choice=event_row['multiple_choice'],
        created_at=event_row['created_at'],
        updated_at=event_row['updated_at'],
        user_id=event_row['user_id'],
        final_slot_id=event_row['final_slot_id'],
        is_creator=event_row['is_creator'],
        creator=creator_data
    )

    slots_data = [
        EventSlotResponse(
            id=row['id'],
            slot_start=row['slot_start'],
            created_at=row['created_at'],
            current_user_voted=row['current_user_voted'],
            vote_count=row['vote_count'],
            voters=[]  # Можно добавить подробную информацию о голосующих при необходимости
        )
        for row in slots_rows
    ]

    participants_data = [
        UserResponse(**dict(row)) for row in participants_rows
    ]

    user_votes_data = [
        CurrentUserVoteResponse(
            slot_id=row['slot_id'],
            created_at=row['created_at']
        )
        for row in user_votes_rows
    ]

    return EventFullResponse(
        event=event_data,
        slots=slots_data,
        participants=participants_data,
        current_user_votes=user_votes_data
    )


async def check_event_ownership(conn: asyncpg.Connection, event_id: int, user_id: int) -> bool:
    """Проверка, является ли пользователь создателем события"""
    query = "SELECT user_id FROM events WHERE id = $1 AND deleted_at IS NULL"
    result = await conn.fetchval(query, event_id)
    return result == user_id if result else False


async def check_slots_have_votes(conn: asyncpg.Connection, slot_ids: List[int]) -> List[int]:
    """Проверка, какие слоты имеют голоса/бронирования"""
    if not slot_ids:
        return []

    query = """
        SELECT DISTINCT slot_id 
        FROM event_votes 
        WHERE slot_id = ANY($1)
    """
    rows = await conn.fetch(query, slot_ids)
    return [row['slot_id'] for row in rows]


async def update_event_data(conn: asyncpg.Connection, event_update: EventUpdate, user_id: int) -> EventFullResponse:
    """Обновление события и его слотов"""

    async with conn.transaction():
        # 1. Обновляем основные данные события
        update_event_query = """
            UPDATE events 
            SET title = $1, description = $2, updated_at = NOW()
            WHERE id = $3 AND deleted_at IS NULL
            RETURNING id
        """

        updated_event_id = await conn.fetchval(
            update_event_query,
            event_update.event.title,
            event_update.event.description,
            event_update.event.id
        )

        if not updated_event_id:
            raise ValueError("Event not found or access denied")

        # 2. Обрабатываем удаление слотов
        if event_update.deletedSlotIds:
            # Проверяем, есть ли голоса у удаляемых слотов
            slots_with_votes = await check_slots_have_votes(conn, event_update.deletedSlotIds)
            if slots_with_votes:
                # Сначала удаляем голоса
                delete_votes_query = ("UPDATE event_votes SET deleted_at = NOW() "
                                      "WHERE slot_id = ANY($1) AND deleted_at IS NULL")
                await conn.execute(delete_votes_query, event_update.deletedSlotIds)

            # Удаляем слоты
            delete_slots_query = """
                UPDATE event_slots SET deleted_at = NOW() 
                WHERE id = ANY($1) AND event_id = $2
            """
            await conn.execute(delete_slots_query, event_update.deletedSlotIds, event_update.event.id)

        # 3. Обновляем существующие слоты и создаем новые
        for slot_data in event_update.slots:
            if slot_data.id is None:
                # Создаем новый слот
                insert_slot_query = """
                    INSERT INTO event_slots (event_id, slot_start) 
                    VALUES ($1, $2)
                """
                await conn.execute(
                    insert_slot_query,
                    event_update.event.id,
                    slot_data.slot_start
                )

    # 4. Возвращаем обновленное событие
    updated_event = await get_event_by_id(conn, event_update.event.id, user_id)
    if not updated_event:
        raise ValueError("Failed to retrieve updated event")

    return updated_event


async def validate_event_update_permissions(conn: asyncpg.Connection, event_update: EventUpdate, user_id: int) -> dict:
    """Валидация прав на обновление события"""

    # Проверяем существование события и права доступа
    event = await get_event_by_id(conn, event_update.event.id, user_id)
    if not event:
        return {"valid": False, "error": "Event not found"}

    if not event.event.is_creator:
        return {"valid": False, "error": "Access denied: not event creator"}

    # Проверяем, что удаляемые слоты принадлежат событию
    if event_update.deletedSlotIds:
        existing_slot_ids = {slot.id for slot in event.slots}
        invalid_slot_ids = set(event_update.deletedSlotIds) - existing_slot_ids
        if invalid_slot_ids:
            return {"valid": False, "error": f"Invalid slot IDs for deletion: {invalid_slot_ids}"}

    # Проверяем, что обновляемые слоты принадлежат событию
    for slot in event_update.slots:
        if slot.id is not None:
            existing_slot_ids = {slot.id for slot in event.slots}
            if slot.id not in existing_slot_ids:
                return {"valid": False, "error": f"Invalid slot ID for update: {slot.id}"}

    return {"valid": True, "event": event}


async def submit_votes_db(conn: asyncpg.Connection, event_id: int, telegram_user_id: int, slot_ids: List[int]) -> Dict[
    str, Any]:
    """
    Оптимизированная версия функции для голосования с минимальным количеством запросов к БД
    """
    print(event_id, telegram_user_id, slot_ids)

    # Валидация входных данных
    if not slot_ids:
        raise HTTPException(status_code=400, detail="No slot IDs provided")

    # 1. ОБЪЕДИНЯЕМ ВСЕ ПРОВЕРКИ В ОДИН ЗАПРОС
    # Получаем всю необходимую информацию одним запросом через CTE и JOIN
    validation_query = """
    WITH user_data AS (
        SELECT id as user_id FROM users WHERE telegram_user_id = $1
    ),
    event_data AS (
        SELECT id, multiple_choice FROM events 
        WHERE id = $2 AND deleted_at IS NULL
    ),
    slot_data AS (
        SELECT id FROM event_slots 
        WHERE event_id = $2 AND id = ANY($3::int[]) AND deleted_at IS NULL
    )
    SELECT 
        u.user_id,
        e.id as event_id,
        e.multiple_choice,
        array_agg(s.id ORDER BY s.id) as valid_slot_ids,
        count(s.id) as valid_slots_count
    FROM user_data u
    CROSS JOIN event_data e
    LEFT JOIN slot_data s ON true
    GROUP BY u.user_id, e.id, e.multiple_choice
    """

    result = await conn.fetchrow(validation_query, telegram_user_id, event_id, slot_ids)

    # Проверка результатов валидации
    if not result or not result['user_id']:
        raise ValueError("User not found")

    if not result['event_id']:
        raise HTTPException(status_code=404, detail="Event not found")

    if not result['multiple_choice'] and len(slot_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple selection not allowed for this event"
        )

    # Проверяем, что все переданные slot_ids валидны
    valid_slot_ids = result['valid_slot_ids'] or []
    if result['valid_slots_count'] != len(slot_ids):
        raise HTTPException(status_code=400, detail="Invalid slot IDs provided")

    user_id = result['user_id']

    # 2. УМНОЕ ОБНОВЛЕНИЕ - УДАЛЯЕМ ТОЛЬКО НЕНУЖНЫЕ, ДОБАВЛЯЕМ ТОЛЬКО НОВЫЕ
    async with conn.transaction():
        # Получаем текущие голоса пользователя для этого события
        current_votes = await conn.fetch(
            """SELECT slot_id FROM event_votes 
               WHERE event_id = $1 AND user_id = $2 AND deleted_at IS NULL""",
            event_id, user_id
        )
        current_slot_ids = {vote['slot_id'] for vote in current_votes}
        new_slot_ids = set(slot_ids)

        # Определяем какие голоса нужно удалить (есть в текущих, но нет в новых)
        slots_to_remove = current_slot_ids - new_slot_ids

        # Определяем какие голоса нужно добавить (есть в новых, но нет в текущих)
        slots_to_add = new_slot_ids - current_slot_ids

        # Удаляем только ненужные голоса
        if slots_to_remove:
            await conn.execute(
                """UPDATE event_votes 
                   SET deleted_at = $4 
                   WHERE event_id = $1 AND user_id = $2 AND slot_id = ANY($3::int[]) AND deleted_at IS NULL""",
                event_id, user_id, list(slots_to_remove), datetime.now()
            )

        # Добавляем только новые голоса
        if slots_to_add:
            values = [(event_id, slot_id, user_id) for slot_id in slots_to_add]
            await conn.executemany(
                """INSERT INTO event_votes (event_id, slot_id, user_id) 
                   VALUES ($1, $2, $3)""",
                values
            )

    return {"status": "success", "ok": True, "votes_submitted": len(slot_ids)}


async def finalized_event_db(conn: asyncpg.Connection, event_id: int, telegram_user_id: int, slot_id: int) -> Dict[str, Any]:
    # 1. ПРОВЕРЯЕМ ВСЕ УСЛОВИЯ ОДНИМ ЗАПРОСОМ
    validation_query = """
    WITH user_data AS (
        SELECT id as user_id FROM users WHERE telegram_user_id = $1
    ),
    event_data AS (
        SELECT 
            e.id,
            e.user_id as event_creator_id,
            e.title,
            e.final_slot_id,
            e.deleted_at as event_deleted_at
        FROM events e 
        WHERE e.id = $2 AND e.deleted_at IS NULL
    ),
    slot_data AS (
        SELECT 
            s.id,
            s.slot_start,
            s.deleted_at as slot_deleted_at
        FROM event_slots s 
        WHERE s.event_id = $2 AND s.id = $3 AND s.deleted_at IS NULL
    )
    SELECT 
        u.user_id,
        e.id as event_id,
        e.event_creator_id,
        e.title as event_title,
        e.final_slot_id as current_final_slot_id,
        s.id as slot_id,
        s.slot_start,
        CASE 
            WHEN u.user_id IS NULL THEN 'user_not_found'
            WHEN e.id IS NULL THEN 'event_not_found'
            WHEN e.event_creator_id != u.user_id THEN 'not_creator'
            WHEN e.final_slot_id IS NOT NULL THEN 'already_finalized'
            WHEN s.id IS NULL THEN 'slot_not_found'
            ELSE 'valid'
        END as validation_status
    FROM user_data u
    FULL OUTER JOIN event_data e ON true
    FULL OUTER JOIN slot_data s ON true
    """

    result = await conn.fetchrow(validation_query, telegram_user_id, event_id, slot_id)

    # Обработка результатов валидации
    if not result:
        raise HTTPException(status_code=500, detail="Validation query failed")

    validation_status = result['validation_status']

    if validation_status == 'user_not_found':
        raise ValueError("User not found")
    elif validation_status == 'event_not_found':
        raise HTTPException(status_code=404, detail="Event not found or already deleted")
    elif validation_status == 'not_creator':
        raise HTTPException(status_code=403, detail="Only event creator can finalize the event")
    elif validation_status == 'already_finalized':
        raise HTTPException(status_code=400, detail="Event is already finalized")
    elif validation_status == 'slot_not_found':
        raise HTTPException(status_code=400, detail="Invalid slot ID or slot is deleted")
    elif validation_status != 'valid':
        raise HTTPException(status_code=400, detail=f"Validation failed: {validation_status}")

    # 2. ЗАВЕРШАЕМ СОБЫТИЕ - УСТАНАВЛИВАЕМ ФИНАЛЬНЫЙ СЛОТ
    async with conn.transaction():
        # Обновляем событие, устанавливая final_slot_id
        finalize_result = await conn.execute(
            """UPDATE events 
               SET final_slot_id = $2, updated_at = NOW() 
               WHERE id = $1 AND deleted_at IS NULL""",
            event_id, slot_id
        )

        # Проверяем, что обновление прошло успешно
        if finalize_result != "UPDATE 1":
            raise HTTPException(status_code=500, detail="Failed to finalize event")

    return {
        "status": "success",
        "ok": True,
        "message": "Event finalized successfully",
    }


async def unfinalize_event_db(conn: asyncpg.Connection, telegram_user_id: int, event_id: int) -> Dict[str, Any]:
    """
    Отменяет завершение события (убирает final_slot_id)
    """
    # Проверяем права пользователя
    validation_query = """
    SELECT 
        e.id,
        e.final_slot_id,
        u.id as user_id
    FROM events e
    JOIN users u ON e.user_id = u.id
    WHERE e.id = $1 AND u.telegram_user_id = $2 AND e.deleted_at IS NULL
    """

    result = await conn.fetchrow(validation_query, event_id, telegram_user_id)

    if not result:
        raise HTTPException(status_code=404, detail="Event not found or access denied")

    if not result['final_slot_id']:
        raise HTTPException(status_code=400, detail="Event is not finalized")

    # Убираем финализацию
    await conn.execute(
        """UPDATE events 
           SET final_slot_id = NULL, updated_at = NOW() 
           WHERE id = $1 AND deleted_at IS NULL""",
        event_id
    )

    return {
        "status": "success",
        "ok": True,
        "message": "Event finalization removed successfully",
        "event_id": event_id
    }
