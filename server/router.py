from aiogram import Bot, F, Router
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.filters import Command, CommandObject, CommandStart

router = Router()


@router.message(Command('start'))
async def command_start_handler(msg: Message) -> None:
    # user = msg.from_user
    # if not await db.add_user_main(user.id, user.username, user.first_name, user.last_name):
    #     await msg.answer('Добро пожаловать в <b>Comunna</b> - <i>набор инструментов для управления вашим сообществом</i>!\n\n'
    #                      'Этот бот поможет вам настроить эффективную платформу для взаимодействия с вашей аудиторией.\n\n'
    #                      'Давайте все настроим. Просто следуйте инструкциям, и вы быстро получите свою готовую систему '
    #                      'для общения c вашей базой пользователей!\n\n'
    #                      'Готовы начать?', reply_markup=kb.start_btn())
    # else:
    #     await msg.answer('Главное меню!', reply_markup=kb.main_menu())
    await msg.answer('Hello, world!')
    await msg.delete()


@router.message(Command('check'))
async def command_check_handler(msg: Message) -> None:
    await msg.answer('check')


@router.message(Command('mini_app'))
async def command_mini_app_handler(msg: Message) -> None:
    await msg.answer('Ваше мини приложение')
