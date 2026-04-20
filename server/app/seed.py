from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session as DBSession

from .database import Base, SessionLocal, engine
from .models import Category, Item, User
from .security import hash_password


CATEGORY_SEED: list[dict] = [
    {
        "name": "Oil Change",
        "slug": "oil-change",
        "icon": "OilIcon",
        "items": [
            ("Conventional Oil Change", "39.99"),
            ("Synthetic Blend Oil Change", "59.99"),
            ("Full Synthetic Oil Change", "79.99"),
            ("Oil Filter Replacement", "12.50"),
        ],
    },
    {
        "name": "Brakes",
        "slug": "brakes",
        "icon": "BrakeWarningIcon",
        "items": [
            ("Front Brake Pads", "120.00"),
            ("Rear Brake Pads", "110.00"),
            ("Brake Rotor (per side)", "95.00"),
            ("Brake Fluid Flush", "65.00"),
            ("Caliper Replacement", "180.00"),
        ],
    },
    {
        "name": "Tires",
        "slug": "tires",
        "icon": "WheelIcon",
        "items": [
            ("Tire Rotation", "25.00"),
            ("Wheel Alignment", "89.99"),
            ("Tire Mount & Balance", "20.00"),
            ("Flat Tire Repair", "30.00"),
        ],
    },
    {
        "name": "Headlights",
        "slug": "headlights",
        "icon": "CarIcon",
        "items": [
            ("Halogen Bulb Replacement", "35.00"),
            ("LED Bulb Upgrade", "120.00"),
            ("Headlight Restoration", "75.00"),
        ],
    },
    {
        "name": "Battery",
        "slug": "battery",
        "icon": "BatteryFullIcon",
        "items": [
            ("Battery Test", "0.00"),
            ("Standard Battery Replacement", "159.99"),
            ("AGM Battery Replacement", "229.99"),
            ("Terminal Cleaning", "20.00"),
        ],
    },
    {
        "name": "A/C",
        "slug": "ac",
        "icon": "AirConditionerIcon",
        "items": [
            ("A/C System Inspection", "45.00"),
            ("Refrigerant Recharge", "120.00"),
            ("Cabin Air Filter Replacement", "35.00"),
            ("Compressor Replacement", "650.00"),
        ],
    },
]


def _seed_admin(db: DBSession) -> None:
    existing = db.scalar(select(User).where(User.username == "admin"))
    if existing:
        return
    db.add(
        User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
        )
    )
    db.commit()


def _seed_catalog(db: DBSession) -> None:
    for c in CATEGORY_SEED:
        cat = db.scalar(select(Category).where(Category.slug == c["slug"]))
        if cat is None:
            cat = Category(name=c["name"], slug=c["slug"], icon=c["icon"])
            db.add(cat)
            db.flush()
        for name, price in c["items"]:
            exists = db.scalar(
                select(Item).where(Item.category_id == cat.id, Item.name == name)
            )
            if exists is None:
                db.add(Item(category_id=cat.id, name=name, base_price=Decimal(price)))
    db.commit()


def _apply_lightweight_migrations() -> None:
    """Idempotent ALTERs for column nullability changes that `create_all` won't apply."""
    statements = (
        "ALTER TABLE estimates ALTER COLUMN vehicle_year DROP NOT NULL",
        "ALTER TABLE estimates ALTER COLUMN license_plate DROP NOT NULL",
    )
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def run() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()
    with SessionLocal() as db:
        _seed_admin(db)
        _seed_catalog(db)
    print("[seed] admin user + categories + items ready")


if __name__ == "__main__":
    run()
