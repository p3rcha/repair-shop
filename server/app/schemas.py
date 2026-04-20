from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import EstimateStatus


Username = Annotated[str, Field(min_length=3, max_length=64)]
Password = Annotated[str, Field(min_length=6, max_length=128)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    created_at: datetime


class RegisterIn(BaseModel):
    username: Username
    password: Password


class LoginIn(BaseModel):
    username: Username
    password: Password


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    icon: str


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_price: Decimal


class EstimateItemIn(BaseModel):
    item_id: int
    quantity: Annotated[int, Field(ge=1, le=999)]


class EstimateItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    item_name: str
    quantity: int
    unit_price: Decimal


class EstimateIn(BaseModel):
    customer_name: Annotated[str, Field(min_length=1, max_length=120)]
    vehicle_make: Annotated[str, Field(min_length=1, max_length=60)]
    vehicle_model: Annotated[str, Field(min_length=1, max_length=60)]
    vehicle_year: Annotated[int | None, Field(ge=1900, le=2100)] = None
    license_plate: Annotated[str | None, Field(max_length=20)] = None
    items: list[EstimateItemIn] = Field(min_length=1)

    @field_validator("license_plate", mode="before")
    @classmethod
    def _empty_plate_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class EstimateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int | None
    license_plate: str | None
    status: EstimateStatus
    total: Decimal
    created_at: datetime
    items: list[EstimateItemOut]


class StatusUpdateIn(BaseModel):
    status: EstimateStatus
