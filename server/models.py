from pydantic import BaseModel, Field, field_validator, field_serializer, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, date
from enum import Enum
from uuid import UUID
import re


class WebAppUser(BaseModel):
    telegram_user_id: int  # Telegram user_id
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    is_premium: bool = False
    allows_write_to_pm: bool = True
    photo_url: Optional[str] = None 


class BotUser(BaseModel):
    telegram_user_id: int  # Telegram user_id
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    is_premium: bool = False


class ValidateResponse(BaseModel):
    status: str
    message: str
    user_id: int


class PublicIdSerializerMixin(BaseModel):
    public_id: UUID | str

    @field_serializer('public_id')
    def _ser_public_id(self, v: UUID | str) -> str:
        return str(v)


class EventType(str, Enum):
    POLL = 'poll'
    BOOKING = 'booking'


class TimeSlotResponse(BaseModel):
    id: int          # ID слота из БД
    time: str        # Время в формате "HH:MM"


class EventDateResponse(BaseModel):
    date: date
    time_slots: List[TimeSlotResponse]


# Базовые поля события (events)
class EventCreateBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(
        None,
        max_length=500,
        description="Адрес, ссылка на Zoom/Meet или другая локация"
    )
    timezone: str = Field(
        default="UTC",
        pattern=r"^[A-Za-z_]+/[A-Za-z_]+$",  # Пример: "Europe/Moscow"
        examples=["Europe/Moscow", "America/New_York"]
    )
    event_type: EventType = Field(default=EventType.POLL, alias="eventType")
    allow_multiple_choice: bool = Field(default=False, alias="allowMultipleChoice")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v: EventType) -> EventType:
        return v


class EventCreate(EventCreateBase):
    dates: List['EventDateCreate']


class EventDateCreate(BaseModel):
    date: datetime  # Дата без времени
    time_slots: List[str] = Field(..., alias="timeSlots")

    @field_validator('time_slots')
    @classmethod
    def validate_time_slots(cls, v: List[str]) -> List[str]:
        for time_slot in v:
            if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', time_slot):
                raise ValueError("Time slots must be in HH:MM format")
        return v


class EventResponse(PublicIdSerializerMixin, EventCreateBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    final_slot_id: Optional[int] = None
    dates: List[EventDateResponse]

    model_config = ConfigDict(from_attributes=True)


class UserEventResponse(PublicIdSerializerMixin):
    id: int
    title: str
    event_type: EventType
    participant_count: int
    final_slot_id: Optional[int] = None
    is_creator: bool

    model_config = ConfigDict(from_attributes=True)


class ActiveEventResponse(UserEventResponse):
    pass


class ArchivedEventResponse(UserEventResponse):
    is_deleted: bool
    is_expired: bool


EventCreate.model_rebuild()
EventDateCreate.model_rebuild()


class UserResponse(BaseModel):
    telegram_user_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    language_code: Optional[str] = None


class SlotVoterResponse(UserResponse):
    voted_at: datetime


class EventSlotResponse(BaseModel):
    id: int
    slot_start: datetime
    created_at: datetime
    current_user_voted: bool
    vote_count: int
    voters: Optional[List[SlotVoterResponse]] = []


class EventDetailsResponse(PublicIdSerializerMixin):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    timezone: str
    event_type: Literal['poll', 'booking']
    multiple_choice: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    user_id: int
    final_slot_id: Optional[int] = None
    is_creator: bool
    creator: UserResponse


class CurrentUserVoteResponse(BaseModel):
    slot_id: int
    created_at: datetime


class EventFullResponse(BaseModel):
    event: EventDetailsResponse
    slots: List[EventSlotResponse]
    participants: List[UserResponse]
    current_user_votes: List[CurrentUserVoteResponse]


class EventUpdateData(PublicIdSerializerMixin):
    """Модель для данных события при обновлении"""
    id: int = Field(..., description="ID события")
    title: str = Field(..., min_length=1, max_length=200, description="Заголовок события")
    description: Optional[str] = Field(None, max_length=1000, description="Описание события")
    location: Optional[str] = Field(
        None,
        max_length=1000,
        description="Локация события"
    )

    @field_validator('title')
    @classmethod
    def title_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

    @field_validator('description')
    @classmethod
    def clean_description(cls, v):
        if v is not None:
            v = v.strip()
            return v if v else None
        return v

    @field_validator('location')
    @classmethod
    def clean_location(cls, v):
        if v is not None:
            v = v.strip()
            return v if v else None
        return v


class SlotUpdateData(BaseModel):
    """Модель для данных слота при обновлении"""
    id: Optional[int] = Field(None, description="ID слота (None для новых слотов)")
    slot_start: datetime = Field(..., description="Время начала слота в UTC")

    @field_validator('slot_start')
    @classmethod
    def slot_start_must_be_future(cls, v):
        # Проверяем только для новых слотов (когда id is None)
        # Для существующих слотов разрешаем прошлое время
        return v


class EventUpdate(BaseModel):
    """Основная модель для обновления события"""
    event: EventUpdateData = Field(..., description="Данные события")
    slots: List[SlotUpdateData] = Field(..., min_items=1, description="Список слотов времени")
    deletedSlotIds: List[int] = Field(default_factory=list, description="ID слотов для удаления")

    @field_validator('slots')
    @classmethod
    def slots_must_not_be_empty(cls, v):
        if not v:
            raise ValueError('At least one slot is required')
        return v

    @field_validator('deletedSlotIds')
    @classmethod
    def validate_deleted_slots(cls, v):
        # Проверяем, что нет дубликатов в списке удаляемых слотов
        if len(v) != len(set(v)):
            raise ValueError('Duplicate slot IDs in deletedSlotIds')
        return v


class ApiResponse(BaseModel):
    """Базовая модель для API ответов"""
    status: str = "success"
    ok: bool = True
    message: Optional[str] = None


class EventUpdateResponse(ApiResponse):
    """Модель ответа при обновлении события"""
    event: Optional[EventFullResponse] = None


class ErrorDetail(BaseModel):
    """Модель для детализации ошибок валидации"""
    field: str
    message: str


class ErrorResponse(BaseModel):
    """Модель для ответов с ошибками"""
    status: str = "error"
    ok: bool = False
    message: str
    errors: Optional[List[ErrorDetail]] = None