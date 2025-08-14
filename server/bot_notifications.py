from aiogram.types import InlineKeyboardMarkup, WebAppInfo, InlineKeyboardButton
from typing import Dict, Any
import asyncio

from bot import telegram_bot
from config import CLIENT_URL


def _is_ru(lang: str | None) -> bool:
    return (lang or "en").lower().startswith("ru")


def _get(obj, key):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


async def send_event_created_pm(user, event):
    # язык
    lang = (getattr(user, "language_code", None) or "en").lower()
    is_ru = lang.startswith("ru")

    # данные события (аккуратно достаём поля)
    title = (getattr(event, "title", None) or "Untitled").strip()
    description = (getattr(event, "description", None) or "").strip()
    public_id = getattr(event, "public_id", None)

    # заголовок и текст
    if is_ru:
        header = "Событие создано ✅"
        desc_text = f"\n{description}" if description else "\nОписание отсутствует."
        btn_text = "Открыть событие"
    else:
        header = "Event created ✅"
        desc_text = f"\n{description}" if description else "\nNo description."
        btn_text = "Open event"

    start_url = f"{CLIENT_URL}/event/public/{public_id}"

    # инлайн-кнопка, которая откроет webApp
    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=btn_text, web_app=WebAppInfo(url=start_url))
    ]])

    text = f"<b>{header}</b>\n\n<b>{title}</b>{desc_text}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=getattr(user, "id"),
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_event_created_pm] Failed to send PM: {e}")


async def send_event_deleted_pm(user, event_like: dict | object | None, fallback_event_id: int):
    """
    Отправляет пользователю PM о том, что событие удалено.
    Без каких-либо кнопок/ссылок.
    """
    lang = (getattr(user, "language_code", None) or "en").lower()
    is_ru = lang.startswith("ru")

    title = (_get(event_like, "title") or "Untitled").strip()
    eid = _get(event_like, "id") or fallback_event_id

    header = "Событие удалено ❌" if is_ru else "Event deleted ❌"
    note = "Событие удалено и больше недоступно." if is_ru else "The event has been deleted and is no longer available."

    text = f"<b>{header}</b>\n\n<b>{title}</b>\nID: {eid}\n\n{note}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=getattr(user, "id"),
            text=text,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_event_deleted_pm] Failed to send PM: {e}")


async def send_event_updated_pm(user, event_like: dict | object):
    """
    Уведомляет пользователя о том, что событие обновлено.
    В тексте: заголовок, опционально описание, ID. Кнопка открывает webApp по public_id.
    """
    lang = (getattr(user, "language_code", None) or "en").lower()
    is_ru = lang.startswith("ru")

    title = (_get(event_like, "title") or "Untitled").strip()
    description = (_get(event_like, "description") or "").strip()
    public_id = _get(event_like, "public_id") or _get(event_like, "publicId")
    eid = _get(event_like, "id")

    header = "Событие обновлено ✏️" if is_ru else "Event updated ✏️"
    btn_text = "Открыть событие" if is_ru else "Open event"
    desc = f"\n{description}" if description else ""

    start_url = f"{CLIENT_URL}/event/public/{public_id}"

    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=btn_text, web_app=WebAppInfo(url=start_url))
    ]])

    text = f"<b>{header}</b>\n\n<b>{title}</b>{desc}\nID: {eid}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=getattr(user, "id"),
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_event_updated_pm] Failed to send PM: {e}")


async def _send_event_updated_to_participant_lang(tg_id: int, lang: str | None, event_like):
    ru = _is_ru(lang)
    title = (_get(event_like, "title") or "Untitled").strip()
    public_id = _get(event_like, "public_id") or _get(event_like, "publicId")
    eid = _get(event_like, "id")

    header = "Событие обновлено ✏️" if ru else "Event updated ✏️"
    btn = "Открыть событие" if ru else "Open event"

    url = await _build_event_startapp_url(public_id)
    markup = _webapp_markup(url, btn)

    text = f"<b>{header}</b>\n\n«{title}»\nID: {eid}" if ru else f"<b>{header}</b>\n\n“{title}”\nID: {eid}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=tg_id,
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[_send_event_updated_to_participant_lang] Failed: {e}")


async def notify_event_updated_participants_from_full(
    full_event_response,           # EventFullResponse
    actor_telegram_user_id: int,   # кто сделал апдейт — исключаем из рассылки
):
    """
    Рассылает уведомления всем участникам события (из .participants),
    используя их персональные language_code.
    """
    if not full_event_response:
        return

    event_like = _get(full_event_response, "event")
    participants = _get(full_event_response, "participants") or []

    tasks = []
    seen = set()  # на случай дублей

    for p in participants:
        tg_id = _get(p, "telegram_user_id")
        if not tg_id or tg_id == actor_telegram_user_id or tg_id in seen:
            continue
        seen.add(tg_id)

        lang = _get(p, "language_code") or "en"
        tasks.append(_send_event_updated_to_participant_lang(tg_id, lang, event_like))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def _user_full_name(u) -> str:
    first = getattr(u, "first_name", None) or ""
    last = getattr(u, "last_name", None) or ""
    return " ".join([p for p in (first.strip(), last.strip()) if p]).strip() or "Unknown"


def _user_at(u) -> str:
    username = getattr(u, "username", None)
    return f"@{username}" if username else ""


async def _build_event_startapp_url(public_id: str | None) -> str:
    try:
        return f"{CLIENT_URL}/event/public/{public_id}" if public_id else f"{CLIENT_URL}/"
    except Exception:
        return f"{CLIENT_URL}/"


def _webapp_markup(url: str, btn_text: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=btn_text, web_app=WebAppInfo(url=url))
    ]])


async def send_creator_vote_notification_from_result(
    submit_result: Dict[str, Any],
    voter_user,  # telegram_data.user
):
    """
    Уведомление создателю: "В событии ... новый ответ от Имя Фамилия | @username" + кнопка на событие.
    Все данные берутся из submit_result (event, creator_telegram_user_id, creator_language_code).
    """
    event = submit_result.get("event") or {}
    creator_telegram_user_id = submit_result.get("creator_telegram_user_id")
    creator_lang = submit_result.get("creator_language_code") or "en"

    if not creator_telegram_user_id:
        return  # нечего слать

    ru = _is_ru(creator_lang)
    title = (event.get("title") or "Untitled").strip()
    public_id = event.get("public_id")

    full = _user_full_name(voter_user)
    at = _user_at(voter_user)
    sep = " | " if at else ""

    header = "Новый ответ по событию" if ru else "New response on event"
    btn = "Открыть событие" if ru else "Open event"

    url = await _build_event_startapp_url(public_id)
    markup = _webapp_markup(url, btn)

    # Пример: В событии «Название» новый ответ от Имя Фамилия | @username
    if ru:
        text = f"<b>{header}</b>\n\n«{title}»\nОт: {full}{sep}{at}"
    else:
        text = f"<b>{header}</b>\n\n“{title}”\nFrom: {full}{sep}{at}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=creator_telegram_user_id,
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_creator_vote_notification_from_result] Failed: {e}")


async def send_voter_vote_notification_from_result(
    submit_result: Dict[str, Any],
    voter_user,
):
    """
    Уведомление участнику: "Вы оставили ответ на событие ..." + кнопка на событие.
    Язык берём из voter_user.language_code.
    """
    event = submit_result.get("event") or {}
    lang = getattr(voter_user, "language_code", None) or "en"
    ru = _is_ru(lang)

    title = (event.get("title") or "Untitled").strip()
    public_id = event.get("public_id")

    header = "Вы оставили ответ на событие" if ru else "You submitted your response for"
    btn = "Открыть событие" if ru else "Open event"

    url = await _build_event_startapp_url(public_id)
    markup = _webapp_markup(url, btn)

    text = f"<b>{header}</b>\n\n«{title}»" if ru else f"<b>{header}</b>\n\n“{title}”"

    try:
        await telegram_bot.bot.send_message(
            chat_id=getattr(voter_user, "id"),
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_voter_vote_notification_from_result] Failed: {e}")


async def notify_about_new_votes_from_submit_result(
    submit_result: Dict[str, Any],
    voter_user,
):
    """
    Оркестратор: шлём оба уведомления на основе результата submit_votes_db.
    """
    creator_telegram_user_id = submit_result.get("creator_telegram_user_id")
    voter_telegram_user_id = getattr(voter_user, "id", None)

    tasks = []
    if creator_telegram_user_id and creator_telegram_user_id != voter_telegram_user_id:
        tasks.append(send_creator_vote_notification_from_result(submit_result, voter_user))
    tasks.append(send_voter_vote_notification_from_result(submit_result, voter_user))

    # Можно await для гарантии, либо запустить в фоне через create_task в месте вызова.
    for t in tasks:
        try:
            await t
        except Exception as e:
            print(f"[notify_about_new_votes_from_submit_result] Task failed: {e}")


def _format_dt(dt) -> str:
    # dt: datetime из БД (обычно naive/UTC). Для простоты — YYYY-MM-DD HH:MM.
    try:
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception as ex:
        print(ex)
        return str(dt)


async def send_finalized_creator_notification(finalize_result: Dict[str, Any]):
    event = finalize_result["event"]
    final_slot = finalize_result["final_slot"]
    creator = finalize_result["creator"]

    ru = _is_ru(creator.get("language_code"))
    title = (event.get("title") or "Untitled").strip()
    slot_str = _format_dt(final_slot.get("slot_start"))
    btn = "Открыть событие" if ru else "Open event"

    url = await _build_event_startapp_url(event.get("public_id"))
    markup = _webapp_markup(url, btn)

    if ru:
        text = f"<b>Событие завершено</b>\n\n«{title}»\nФинальный слот: {slot_str}"
    else:
        text = f"<b>Event finalized</b>\n\n“{title}”\nFinal slot: {slot_str}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=creator["telegram_user_id"],
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_finalized_creator_notification] Failed: {e}")


async def send_finalized_participant_notification(user_tg_id: int, lang: str, event: Dict[str, Any], final_slot: Dict[str, Any]):
    ru = _is_ru(lang)
    title = (event.get("title") or "Untitled").strip()
    slot_str = _format_dt(final_slot.get("slot_start"))
    btn = "Открыть событие" if ru else "Open event"

    url = await _build_event_startapp_url(event.get("public_id"))
    markup = _webapp_markup(url, btn)

    if ru:
        text = f"<b>Событие завершено</b>\n\n«{title}»\nФинальный слот: {slot_str}"
    else:
        text = f"<b>Event finalized</b>\n\n“{title}”\nFinal slot: {slot_str}"

    try:
        await telegram_bot.bot.send_message(
            chat_id=user_tg_id,
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_finalized_participant_notification] Failed: {e}")


async def notify_event_finalized(finalize_result: Dict[str, Any]):
    """
    Отправляет:
    - создателю: подтверждение о завершении, финальный слот, кнопка на событие
    - всем проголосовавшим: уведомление о завершении, финальный слот, кнопка на событие
    Создателя из рассылки по участникам исключаем.
    """
    event = finalize_result["event"]
    final_slot = finalize_result["final_slot"]
    creator = finalize_result["creator"]
    participants = finalize_result.get("participants", [])

    # сообщение создателю
    await send_finalized_creator_notification(finalize_result)

    # рассылка участникам
    creator_tg_id = creator.get("telegram_user_id")
    tasks = []
    for p in participants:
        p_tg = p["telegram_user_id"]
        if not p_tg or p_tg == creator_tg_id:
            continue
        tasks.append(
            send_finalized_participant_notification(
                p_tg,
                p.get("language_code") or "en",
                event,
                final_slot
            )
        )
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def send_restored_creator_notification(restore_result: Dict[str, Any]):
    event = restore_result["event"]
    creator = restore_result["creator"]

    ru = _is_ru(creator.get("language_code"))
    title = (event.get("title") or "Untitled").strip()
    btn = "Открыть событие" if ru else "Open event"
    url = await _build_event_startapp_url(event.get("public_id"))
    markup = _webapp_markup(url, btn)

    text = (
        f"<b>Событие восстановлено</b>\n\n«{title}»\nСобытие снова доступно."
        if ru else
        f"<b>Event restored</b>\n\n“{title}”\nThe event is available again."
    )

    try:
        await telegram_bot.bot.send_message(
            chat_id=creator["telegram_user_id"],
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_restored_creator_notification] Failed: {e}")


async def send_restored_participant_notification(user_tg_id: int, lang: str, event: Dict[str, Any]):
    ru = _is_ru(lang)
    title = (event.get("title") or "Untitled").strip()
    btn = "Открыть событие" if ru else "Open event"
    url = await _build_event_startapp_url(event.get("public_id"))
    markup = _webapp_markup(url, btn)

    text = (
        f"<b>Событие восстановлено</b>\n\n«{title}»\nСобытие снова доступно."
        if ru else
        f"<b>Event restored</b>\n\n“{title}”\nThe event is available again."
    )

    try:
        await telegram_bot.bot.send_message(
            chat_id=user_tg_id,
            text=text,
            reply_markup=markup,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        print(f"[send_restored_participant_notification] Failed: {e}")


async def notify_event_restored(restore_result: Dict[str, Any]):
    """
    Отправляет:
    - создателю: уведомление о восстановлении + кнопка на событие
    - всем проголосовавшим: уведомление о восстановлении + кнопка на событие
    """
    event = restore_result["event"]
    creator = restore_result["creator"]
    participants = restore_result.get("participants", [])

    # Создателю
    await send_restored_creator_notification(restore_result)

    # Участникам (исключаем создателя)
    creator_tg_id = creator.get("telegram_user_id")
    tasks = []
    for p in participants:
        p_tg = p["telegram_user_id"]
        if not p_tg or p_tg == creator_tg_id:
            continue
        tasks.append(send_restored_participant_notification(p_tg, p.get("language_code") or "en", event))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
