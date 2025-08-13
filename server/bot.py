import logging
from typing import Any, Dict

from aiogram import Bot, Dispatcher
from aiogram.types import Update, Message
from aiogram.utils.web_app import safe_parse_webapp_init_data, WebAppInitData

from config import BOT_TOKEN, WEBHOOK_PATH, WEBHOOK_SECRET
from router import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot configuration
BOT_TOKEN = BOT_TOKEN
WEBHOOK_SECRET = WEBHOOK_SECRET
WEBHOOK_PATH = WEBHOOK_PATH

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

dp.include_router(router)


class TelegramBot:
    def __init__(self):
        self.bot = bot
        self.dp = dp
        # self.setup_handlers()

    # def setup_handlers(self):
    #     @self.dp.message()
    #     async def echo_handler(msg: Message) -> None:
    #         try:
    #             await msg.answer(f"Echo: {msg.text}")
    #         except TypeError:
    #             await msg.answer("Nice try!")

    async def set_webhook(self, webhook_url: str):
        try:
            await self.bot.set_webhook(
                url=webhook_url,
                secret_token=WEBHOOK_SECRET
            )
            logger.info(f"Webhook set to {webhook_url}")
        except Exception as e:
            logger.error(f"Failed to set webhook: {e}")

    async def delete_webhook(self):
        try:
            await self.bot.delete_webhook()
            logger.info("Webhook deleted")
        except Exception as e:
            logger.error(f"Failed to delete webhook: {e}")

    async def process_update(self, update_data: Dict[str, Any]):
        try:
            update = Update(**update_data)
            await self.dp.feed_update(bot=self.bot, update=update)
        except Exception as e:
            logger.error(f"Error processing update: {e}")

    async def get_webhook_info(self):
        try:
            webhook_info = await self.bot.get_webhook_info()
            return {
                "url": webhook_info.url,
                "has_custom_certificate": webhook_info.has_custom_certificate,
                "pending_update_count": webhook_info.pending_update_count,
                "last_error_date": webhook_info.last_error_date,
                "last_error_message": webhook_info.last_error_message,
                "max_connections": webhook_info.max_connections,
                "allowed_updates": webhook_info.allowed_updates
            }
        except Exception as e:
            logger.error(f"Failed to get webhook info: {e}")
            return None


telegram_bot = TelegramBot()


def verify_webapp_init_data(init_data: str, bot_token: str) -> WebAppInitData | None:
    try:
        parsed_data = safe_parse_webapp_init_data(
            token=bot_token,
            init_data=init_data
        )
        return parsed_data
    except ValueError as e:
        logger.warning(f"Invalid webapp init data: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing webapp init data: {e}")
        return None


async def get_bot_instance():
    return telegram_bot
