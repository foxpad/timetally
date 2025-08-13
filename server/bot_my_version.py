from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode


from config import BOT_TOKEN

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()


# MAIN

# import os
# from datetime import datetime, timedelta
# from typing import Callable, Awaitable, Any
#
# from aiogram.utils.web_app import safe_parse_webapp_init_data
#
# from fastapi import FastAPI, Request, HTTPException, Depends
# from fastapi.templating import Jinja2Templates
# from fastapi.staticfiles import StaticFiles
# from fastapi.responses import JSONResponse
#
# from bot import bot
#
#
# app = FastAPI(title="Meety API by Comunna", version="1.0.0")
#
#
# # def auth(request: Request):
#     try:
#         auth_string = request.headers.get("Authorization", None)
#         if auth_string:
#             data = safe_parse_webapp_init_data(bot.token, auth_string)
#             return data
#         else:
#             raise HTTPException(401, {"error", "Unauthorized"})
#     except Exception as ex:
#         print(ex)
#         raise HTTPException(401, {"error", "Unauthorized"})
#
#
# @app.get("/api/validate", response_class=JSONResponse)
# async def validate_user(request: Request, auth_data: dict = Depends(auth)):
#     pass
#
