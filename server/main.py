import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, Union
import asyncpg

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from aiogram.utils.web_app import safe_parse_webapp_init_data

from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone
import tempfile
from typing import Optional

import uvicorn
import os
from typing import Optional, List
from datetime import datetime, date, time
import asyncio
import json

from pydantic import ValidationError

from bot_notifications import send_event_created_pm, send_event_deleted_pm, send_event_updated_pm, \
    send_voter_vote_notification_from_result, notify_about_new_votes_from_submit_result, notify_event_finalized, \
    notify_event_restored, notify_event_updated_participants_from_full
from models import WebAppUser, EventCreate, EventResponse, EventUpdate, EventUpdateResponse, ErrorResponse, ErrorDetail
from db import create_or_update_user, create_event, get_active_user_events, get_archived_user_events, \
    get_event_details_db, delete_event_db, update_event_data, validate_event_update_permissions, submit_votes_db, \
    finalized_event_db, get_event_by_public_id, restore_event_db, update_event_location_on_finalize

from db import Database
from bot import telegram_bot, verify_webapp_init_data, BOT_TOKEN, WEBHOOK_SECRET, WEBHOOK_PATH
from config import WEBHOOK_URL

db = Database()


async def get_db():
    """Генератор соединений для FastAPI Depends"""
    async with (await db.get_connection()) as connection:
        yield connection


async def verify_telegram_webapp(request: Request):
    auth_string = request.headers.get("Authorization")
    if not auth_string:
        raise HTTPException(401, detail="Authorization header missing")

    verified_data = verify_webapp_init_data(
        init_data=auth_string,
        bot_token=telegram_bot.bot.token
    )

    if not verified_data:
        raise HTTPException(401, detail="Invalid Telegram auth data")

    return verified_data


async def get_user_from_telegram_data(parsed_data) -> WebAppUser:
    if getattr(parsed_data.user, 'is_premim', None):
        is_premium = False
    else:
        is_premium = True
    user = WebAppUser(
        telegram_user_id=parsed_data.user.id,
        username=parsed_data.user.username,
        first_name=parsed_data.user.first_name,
        last_name=parsed_data.user.last_name,
        language_code=parsed_data.user.language_code,
        is_premium=is_premium,
        allows_write_to_pm=parsed_data.user.allows_write_to_pm,
        photo_url=parsed_data.user.photo_url
    )
    return user


@asynccontextmanager
async def app_lifespan(_: FastAPI) -> AsyncIterator[None]:
    await db.connect()

    webhook_url = WEBHOOK_URL
    if webhook_url:
        await telegram_bot.set_webhook(f"{webhook_url}{WEBHOOK_PATH}")

    yield

    await db.close()
    await telegram_bot.delete_webhook()


app = FastAPI(lifespan=app_lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://59f74413ea67.ngrok-free.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    if db.pool is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    async with db.pool.acquire() as connection:
        return JSONResponse(content={"message": "Meety API by Comunna is running"})


# Telegram webhook endpoint
@app.post(WEBHOOK_PATH)
async def webhook(request: Request):
    secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if secret_token != WEBHOOK_SECRET:
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid secret token"}
        )

    # Process update
    update_data = await request.json()
    try:
        await telegram_bot.process_update(update_data)
        return JSONResponse(content={"ok": True})
    except Exception as ex:
        print(f'Error processing update: {ex}')
        raise HTTPException(status_code=500, detail="Internal Server Error")


# Bot management endpoints
@app.get("/bot/webhook-info")
async def get_webhook_info():
    info = await telegram_bot.get_webhook_info()
    return JSONResponse(content=info)


@app.post("/bot/set-webhook")
async def set_webhook(webhook_url: str):
    await telegram_bot.set_webhook(webhook_url)
    return JSONResponse(content={"message": "Webhook set successfully"})


@app.delete("/bot/webhook")
async def delete_webhook():
    await telegram_bot.delete_webhook()
    return JSONResponse(content={"message": "Webhook deleted successfully"})


@app.post("/api/validate")
async def validate_telegram_user(request: Request, conn=Depends(get_db), telegram_data=Depends(verify_telegram_webapp)):
    webapp_user = await get_user_from_telegram_data(telegram_data)
    return await create_or_update_user(conn, webapp_user)


@app.post("/api/events/create")
async def create_new_event(request: Request, conn: asyncpg.Connection = Depends(get_db),
                           telegram_data=Depends(verify_telegram_webapp)):
    raw_body = await request.body()
    try:
        data = json.loads(raw_body)
        event_data = EventCreate(**data)
        event = await create_event(conn, event_data, telegram_data.user.id)
        asyncio.create_task(send_event_created_pm(telegram_data.user, event))
        return {"status": "success", "ok": True, "event": event.model_dump()}
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON format")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())


@app.get("/api/events/active")
async def get_active_events(request: Request, conn: asyncpg.Connection = Depends(get_db),
                            telegram_data=Depends(verify_telegram_webapp)):
    user_id = telegram_data.user.id
    try:
        events = await get_active_user_events(conn, user_id)
        return [dict(event) for event in events]
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON format")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())


@app.get("/api/events/archived")
async def get_archived_events(request: Request, conn: asyncpg.Connection = Depends(get_db),
                              telegram_data=Depends(verify_telegram_webapp)):
    user_id = telegram_data.user.id
    try:
        events = await get_archived_user_events(conn, user_id)
        return [dict(event) for event in events]
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON format")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())


@app.get("/api/events/{event_id}")
async def get_event_details(event_id: int, conn: asyncpg.Connection = Depends(get_db),
                            telegram_data=Depends(verify_telegram_webapp)):
    user_id = telegram_data.user.id
    event_details = await get_event_details_db(conn, user_id, event_id)
    return event_details


@app.get("/api/events/public/{event_public_id}")
async def get_event_details(event_public_id: str, conn: asyncpg.Connection = Depends(get_db),
                            telegram_data=Depends(verify_telegram_webapp)):
    user_id = telegram_data.user.id
    event_details = await get_event_by_public_id(conn, user_id, event_public_id)
    return event_details


@app.delete("/api/events/{event_id}/delete")
async def delete_event(event_id: int, conn: asyncpg.Connection = Depends(get_db),
                       telegram_data=Depends(verify_telegram_webapp)):
    user_id = telegram_data.user.id
    result = await delete_event_db(conn, user_id, event_id)
    if result.get("ok"):
        asyncio.create_task(send_event_deleted_pm(telegram_data.user, result.get("event"), fallback_event_id=event_id))
    return result


@app.put("/api/events/{event_id}", response_model=Union[EventUpdateResponse, ErrorResponse])
async def update_event(event_id: int, request: Request, conn: asyncpg.Connection = Depends(get_db),
                       telegram_data=Depends(verify_telegram_webapp)):
    try:
        raw_body = await request.body()
        data = json.loads(raw_body)
        event_update = EventUpdate(**data)

        if event_update.event.id != event_id:
            raise HTTPException(
                status_code=400,
                detail="Event ID in URL doesn't match ID in request body"
            )

        # 4. Валидируем права доступа и бизнес-логику
        validation_result = await validate_event_update_permissions(conn, event_update, telegram_data.user.id)

        if not validation_result["valid"]:
            error_detail = validation_result.get("error", "Validation failed")

            # Определяем статус код на основе типа ошибки
            if "not found" in error_detail.lower():
                status_code = 404
            elif "access denied" in error_detail.lower():
                status_code = 403
            else:
                status_code = 422

            raise HTTPException(status_code=status_code, detail=error_detail)

        # 5. Выполняем обновление события
        try:
            updated_event = await update_event_data(conn, event_update, telegram_data.user.id)
            asyncio.create_task(send_event_updated_pm(telegram_data.user, updated_event.event))
            asyncio.create_task(
                notify_event_updated_participants_from_full(
                    full_event_response=updated_event,
                    actor_telegram_user_id=telegram_data.user.id,
                )
            )

            # 6. Возвращаем успешный результат
            return EventUpdateResponse(
                status="success",
                ok=True,
                message="Event updated successfully",
                event=updated_event
            )

        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail="Invalid JSON format"
        )

    except ValidationError as e:
        error_details = []
        for error in e.errors():
            field_path = " -> ".join(str(loc) for loc in error["loc"])
            error_details.append(
                ErrorDetail(
                    field=field_path,
                    message=error["msg"]
                )
            )

        raise HTTPException(
            status_code=422,
            detail={
                "message": "Validation error",
                "errors": [detail.dict() for detail in error_details]
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@app.post("/api/events/{event_id}/votes")
async def submit_votes(event_id: int, request: Request, conn: asyncpg.Connection = Depends(get_db),
                       telegram_data=Depends(verify_telegram_webapp)):
    voter_user = telegram_data.user

    # 1) Безопасно читаем JSON
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid JSON format")

    # 2) Достаём и валидируем slot_ids
    slot_ids = payload.get("slot_ids")
    if not isinstance(slot_ids, list) or len(slot_ids) == 0:
        raise HTTPException(status_code=400, detail="No slots selected")

    # приводим к уникальным int, чтобы не падать на дубликатах
    try:
        slot_ids = sorted({int(s) for s in slot_ids})
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="slot_ids must be an array of integers")

    if not slot_ids:
        raise HTTPException(status_code=400, detail="No slots selected")

    # 3) Пишем голоса
    try:
        result = await submit_votes_db(conn, event_id, voter_user.id, slot_ids)
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 4) Уведомления (не блокируем ответ API)
    #    - Создателю шлём только если были изменения (added/removed)
    #    - Участнику шлём всегда подтверждение
    try:
        from_notifications = False  # просто чтобы подчеркнуть, что ниже — фоновая логика
        if result.get("slots_added") or result.get("slots_removed"):
            asyncio.create_task(
                notify_about_new_votes_from_submit_result(result, voter_user)
            )
        else:
            # нет изменений — отправим только участнику подтверждение
            asyncio.create_task(
                send_voter_vote_notification_from_result(result, voter_user)
            )
    except Exception as e:
        # ошибки отправки уведомлений не мешают основному ответу
        print(f"[submit_votes] notify failed: {e}")

    # 5) Возвращаем результат записи голосов
    return result


@app.post("/api/events/{event_id}/finalized")
async def finalized_poll(
    event_id: int,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    telegram_data=Depends(verify_telegram_webapp)
):
    user_id = telegram_data.user.id
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid JSON format")

    slot_id = data.get("slot_id")
    location = data.get("location")
    if not slot_id:
        raise HTTPException(status_code=400, detail="No slot selected")

    try:
        if location:
            await update_event_location_on_finalize(conn, event_id, location)
        result = await finalized_event_db(conn, event_id, user_id, int(slot_id))
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Фоново шлём уведомления (чтобы не тормозить ответ)
    try:
        asyncio.create_task(notify_event_finalized(result))
    except Exception as e:
        print(f"[finalized_poll] notify failed: {e}")

    return result


@app.post("/api/events/{event_id}/unfinalize")
async def restore_event(
    event_id: int,
    conn: asyncpg.Connection = Depends(get_db),
    telegram_data=Depends(verify_telegram_webapp),
):
    user_id = telegram_data.user.id
    try:
        result = await restore_event_db(conn, user_id, event_id)
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Фоново шлём уведомления, чтобы не блокировать ответ
    try:
        asyncio.create_task(notify_event_restored(result))
    except Exception as e:
        print(f"[restore_event] notify failed: {e}")

    return result


class ICSRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    startDate: str  # ISO string
    endDate: Optional[str] = None
    location: Optional[str] = ""
    timezone: Optional[str] = "UTC"


def escape_ics_text(text: str) -> str:
    """Escape special characters for ICS format"""
    if not text:
        return ""
    return (text.replace("\\", "\\\\")
            .replace(",", "\\,")
            .replace(";", "\\;")
            .replace("\n", "\\n")
            .replace("\r", ""))


def format_ics_date(dt: datetime) -> str:
    """Format datetime for ICS (YYYYMMDDTHHMMSSZ)"""
    return dt.strftime("%Y%m%dT%H%M%SZ")


def generate_ics_content(request: ICSRequest) -> str:
    """Generate ICS file content"""
    try:
        # Parse start date
        start_dt = datetime.fromisoformat(request.startDate.replace('Z', '+00:00'))
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)

        # Parse end date or default to 1 hour later
        if request.endDate:
            end_dt = datetime.fromisoformat(request.endDate.replace('Z', '+00:00'))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        else:
            end_dt = start_dt.replace(hour=start_dt.hour + 1)

        # Convert to UTC for ICS
        start_utc = start_dt.astimezone(timezone.utc)
        end_utc = end_dt.astimezone(timezone.utc)

        # Generate unique ID
        event_uid = f"{uuid.uuid4()}@telegram-event.com"
        timestamp = format_ics_date(datetime.now(timezone.utc))

        # Build ICS content
        ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Telegram Event//Event//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{event_uid}
DTSTAMP:{timestamp}
DTSTART:{format_ics_date(start_utc)}
DTEND:{format_ics_date(end_utc)}
SUMMARY:{escape_ics_text(request.title)}
DESCRIPTION:{escape_ics_text(request.description)}
LOCATION:{escape_ics_text(request.location)}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR"""

        return ics_content.replace('\n', '\r\n')

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing dates: {str(e)}")


@app.post("/api/generate-ics")
async def generate_ics(request: ICSRequest):
    print(1)
    """Generate ICS file and return download URL"""
    try:
        # Generate ICS content
        ics_content = generate_ics_content(request)

        # Create temp directory if it doesn't exist
        temp_dir = Path("temp/ics")
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        filename = f"event_{uuid.uuid4().hex[:8]}.ics"
        filepath = temp_dir / filename

        # Write ICS file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(ics_content)

        # Return download URL
        download_url = f"/download/ics/{filename}"

        return {
            "success": True,
            "downloadUrl": download_url,
            "filename": filename
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating ICS file: {str(e)}")


@app.get("/download/ics/{filename}")
async def download_ics(filename: str):
    """Download ICS file"""
    # Validate filename to prevent path traversal
    if not filename.endswith('.ics') or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = Path("temp/ics") / filename

    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=filepath,
        media_type='text/calendar',
        filename=filename,
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


# Optional: Cleanup old files endpoint
@app.delete("/api/cleanup-ics")
async def cleanup_old_ics_files():
    """Clean up ICS files older than 1 hour"""
    try:
        temp_dir = Path("temp/ics")
        if not temp_dir.exists():
            return {"cleaned": 0}

        current_time = datetime.now().timestamp()
        cleaned_count = 0

        for file_path in temp_dir.glob("*.ics"):
            # Check if file is older than 1 hour
            if current_time - file_path.stat().st_mtime > 3600:
                file_path.unlink()
                cleaned_count += 1

        return {"cleaned": cleaned_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during cleanup: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=80)

