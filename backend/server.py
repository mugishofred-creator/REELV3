from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import statistics as st
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import requests as http_req


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Vinted proxy config ───────────────────────────────────────────────────────
VINTED_BASE = "https://www.vinted.fr/api/v2"
_VINTED_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 "
        "com.vinted.ios/22.44.2"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": "https://www.vinted.fr/",
    "Origin": "https://www.vinted.fr",
    "X-Device-Id": "ios",
}
# Shared session so cookies (including Datadome) persist across requests
_vinted_session = http_req.Session()
_vinted_session.headers.update(_VINTED_HEADERS)


def _vinted_get(url: str, params: dict) -> dict:
    """Synchronous Vinted GET — run via asyncio.to_thread."""
    resp = _vinted_session.get(url, params=params, timeout=12)
    resp.raise_for_status()
    return resp.json()


def _parse_price(raw) -> float:
    if isinstance(raw, dict):
        return float(raw.get("amount", 0) or 0)
    try:
        return float(raw or 0)
    except (TypeError, ValueError):
        return 0.0


# ── Define Models ─────────────────────────────────────────────────────────────
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# ── Original routes ───────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ── Vinted — market price ─────────────────────────────────────────────────────
@api_router.get("/vinted/market-price")
async def vinted_market_price(
    brand: str = Query(default=""),
    category: str = Query(default=""),
):
    """
    Search Vinted catalog for brand+category and compute price statistics.
    Returns median, average, min, max and a sample of listings.
    """
    query = f"{brand} {category}".strip()
    if not query:
        raise HTTPException(status_code=400, detail="brand or category required")

    try:
        params = {
            "search_text": query,
            "per_page": 96,
            "page": 1,
            "order": "relevance",
        }
        data = await asyncio.to_thread(_vinted_get, f"{VINTED_BASE}/catalog/items", params)
        items = data.get("items", [])

        prices: list[float] = []
        samples: list[dict] = []
        for item in items:
            price = _parse_price(item.get("price"))
            if price <= 0:
                continue
            prices.append(price)
            photo = ""
            photos = item.get("photos", [])
            if photos:
                photo = photos[0].get("url", photos[0].get("full_size_url", ""))
            if len(samples) < 12:
                samples.append({
                    "title": item.get("title", ""),
                    "price": price,
                    "brand": item.get("brand_title", ""),
                    "photo": photo,
                })

        if not prices:
            return {"query": query, "count": 0, "median": 0, "average": 0,
                    "min": 0, "max": 0, "samples": [], "error": "no_results"}

        return {
            "query": query,
            "count": len(prices),
            "median": round(st.median(prices), 2),
            "average": round(sum(prices) / len(prices), 2),
            "min": round(min(prices), 2),
            "max": round(max(prices), 2),
            "samples": samples,
        }

    except http_req.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        logger.warning(f"Vinted market-price HTTP {status}: {e}")
        raise HTTPException(status_code=502, detail=f"Vinted returned {status}")
    except http_req.exceptions.RequestException as e:
        logger.error(f"Vinted market-price network error: {e}")
        raise HTTPException(status_code=502, detail="Vinted unreachable")
    except Exception as e:
        logger.error(f"Vinted market-price unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Vinted — user catalogue ───────────────────────────────────────────────────
@api_router.get("/vinted/user-items/{user_id}")
async def vinted_user_items(user_id: str):
    """
    Fetch all active listings for a public Vinted user profile.
    Returns a normalised list ready for stock import.
    """
    try:
        all_items: list[dict] = []
        page = 1
        while page <= 5:  # max 5 pages = 500 items
            params = {"page": page, "per_page": 100, "order": "newest_first"}
            data = await asyncio.to_thread(
                _vinted_get, f"{VINTED_BASE}/users/{user_id}/items", params
            )
            batch = data.get("items", [])
            if not batch:
                break
            all_items.extend(batch)
            pagination = data.get("pagination", {})
            if page >= pagination.get("total_pages", 1):
                break
            page += 1

        result: list[dict] = []
        for item in all_items:
            photo_url = ""
            photos = item.get("photos", [])
            if photos:
                photo_url = photos[0].get("url", photos[0].get("full_size_url", ""))
            result.append({
                "id": str(item.get("id", "")),
                "title": item.get("title", ""),
                "price": _parse_price(item.get("price")),
                "brand": item.get("brand_title", ""),
                "category": item.get("category_title", ""),
                "photoUrl": photo_url,
                "status": str(item.get("status", "")),
            })
        return result

    except http_req.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        logger.warning(f"Vinted user-items HTTP {status} for user {user_id}: {e}")
        if status == 404:
            raise HTTPException(status_code=404, detail="User not found on Vinted")
        raise HTTPException(status_code=502, detail=f"Vinted returned {status}")
    except http_req.exceptions.RequestException as e:
        logger.error(f"Vinted user-items network error: {e}")
        raise HTTPException(status_code=502, detail="Vinted unreachable")
    except Exception as e:
        logger.error(f"Vinted user-items unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Vinted — health check ─────────────────────────────────────────────────────
@api_router.get("/vinted/ping")
async def vinted_ping():
    """Quick check that we can reach Vinted."""
    try:
        data = await asyncio.to_thread(
            _vinted_get, f"{VINTED_BASE}/catalog/items",
            {"search_text": "test", "per_page": 1}
        )
        return {"ok": True, "items_found": len(data.get("items", []))}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Include router & middleware ───────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
