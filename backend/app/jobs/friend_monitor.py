from datetime import datetime

import httpx
from apscheduler.schedulers.background import BackgroundScheduler


from ..db import SessionLocal
from ..models import Friend


def check_all_friends():
    db = SessionLocal()
    try:
        friends = db.query(Friend).all()
        active = inactive = 0
        for friend in friends:
            try:
                r = httpx.head(friend.url, timeout=5, follow_redirects=True)
                friend.is_active = r.status_code < 400
            except Exception:
                friend.is_active = False
            friend.last_check = datetime.now()
            active += friend.is_active
            inactive += not friend.is_active
        db.commit()
        return {"total": len(friends), "active": active, "inactive": inactive}
    finally:
        db.close()

