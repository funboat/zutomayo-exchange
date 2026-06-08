from pydantic import BaseModel


class CategoryCreate(BaseModel):
    key: str
    label: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    label: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: int
    key: str
    label: str
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}
